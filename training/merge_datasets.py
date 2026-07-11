"""
Hello Lucky - 내려받은 YOLO 데이터셋들을 하나로 병합

왜 필요한가:
  데이터셋마다 클래스 이름이 다릅니다. (예: 'clover-4', '4-leaf', 'four_leaf')
  또 어떤 데이터셋은 세잎/배경 박스도 함께 들어 있습니다.
  앱(cloverDetection.ts)의 필터는 'four_leaf' 계열 이름만 통과시키므로,
  학습 데이터의 네잎 박스도 반드시 'four_leaf' 단일 클래스로 통일해야
  나중에 감지 결과가 앱에서 걸러지지 않습니다.

이 스크립트가 하는 일:
  1. datasets_raw/ 아래 각 데이터셋의 data.yaml 을 읽어 클래스 이름을 파악
  2. '네잎' 으로 판단되는 박스만 남겨 클래스 0 ('four_leaf') 로 재매핑
  3. 세잎/기타 박스는 제거 (그 이미지는 배경=하드 네거티브로 계속 활용)
  4. train/valid/test 를 유지한 채 merged/ 로 이미지+라벨 복사
  5. 단일 클래스 data.yaml 생성 → Colab 학습에 그대로 사용

주의:
  '네잎 판정' 은 클래스 이름 문자열 기반 추정입니다.
  실행하면 판정 결과 표를 출력하니, 반드시 눈으로 확인하세요.
  애매한 이름은 CLASS_OVERRIDES 로 직접 지정할 수 있습니다.

사용법:
  python training/merge_datasets.py
  python training/merge_datasets.py --dry-run   # 복사 없이 판정 결과만 확인
"""

import sys
import shutil
import argparse
from pathlib import Path

# Windows 콘솔(cp949)에서도 이모지가 깨지지 않도록 UTF-8 출력으로 전환.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "datasets_raw"
MERGED_DIR = BASE_DIR / "merged"

# 앱 .env(EXPO_PUBLIC_ROBOFLOW_TARGET_LABELS) 와 반드시 일치해야 하는 최종 클래스 이름.
TARGET_CLASS = "four_leaf"

SPLITS = ["train", "valid", "test"]
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# 클래스 이름 판정을 강제로 덮어쓰고 싶을 때 (정규화된 이름 → True=네잎 / False=버림).
# 예: CLASS_OVERRIDES = {"clover": True, "background": False}
CLASS_OVERRIDES: dict[str, bool] = {}


def normalize(name: str) -> str:
    """클래스 이름을 비교용으로 정규화: 소문자 + 공백/_/- 제거."""
    return name.strip().lower().replace(" ", "").replace("_", "").replace("-", "")


def is_four_leaf(name: str) -> bool:
    """클래스 이름이 '네잎' 을 뜻하는지 추정."""
    n = normalize(name)
    if n in CLASS_OVERRIDES:
        return CLASS_OVERRIDES[n]
    # 세잎/배경 계열은 명시적으로 버린다.
    if "three" in n or "3leaf" in n or n in {"background", "clover3", "3"}:
        return False
    # 네잎 신호: 'four' 포함, 또는 클로버 맥락에서 '4' 포함.
    if "four" in n:
        return True
    if "4" in n:
        return True
    # 단순 'clover' 처럼 개수 표시가 없는 경우: 이 데이터셋들이 모두
    # '네잎클로버 감지' 목적이므로 네잎으로 간주하되, 표에서 경고 표시.
    if "clover" in n:
        return True
    return False


def parse_names_from_yaml(yaml_path: Path) -> list[str]:
    """data.yaml 에서 names 목록을 추출. pyyaml 이 있으면 사용, 없으면 최소 파서."""
    text = yaml_path.read_text(encoding="utf-8")
    try:
        import yaml

        data = yaml.safe_load(text)
        names = data.get("names")
        if isinstance(names, dict):  # {0: 'a', 1: 'b'} 형태
            return [names[k] for k in sorted(names)]
        if isinstance(names, list):
            return names
    except ImportError:
        pass

    # ---- pyyaml 없을 때의 최소 파서 ----
    # 지원 형태:
    #   names: ['a', 'b']
    #   names:\n  - a\n  - b
    import re

    m = re.search(r"names:\s*\[(.*?)\]", text, re.S)
    if m:
        inner = m.group(1)
        return [p.strip().strip("'\"") for p in inner.split(",") if p.strip()]

    names = []
    in_block = False
    for line in text.splitlines():
        if re.match(r"^\s*names:\s*$", line):
            in_block = True
            continue
        if in_block:
            m2 = re.match(r"^\s*-\s*(.+?)\s*$", line)
            if m2:
                names.append(m2.group(1).strip().strip("'\""))
            elif line.strip() and not line.startswith(" "):
                break
    return names


def find_split_dir(dataset_dir: Path, split: str) -> Path | None:
    """데이터셋 안에서 split(train/valid/test) 폴더를 찾는다. 'val' 별칭도 처리."""
    candidates = [split]
    if split == "valid":
        candidates.append("val")
    for c in candidates:
        d = dataset_dir / c
        if (d / "images").is_dir() and (d / "labels").is_dir():
            return d
    return None


def remap_label_file(src_txt: Path, keep_indices: set[int]) -> list[str]:
    """YOLO 라벨을 읽어 네잎 박스만 남기고 클래스 인덱스를 0 으로 바꾼다."""
    out_lines = []
    for line in src_txt.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        try:
            cls = int(float(parts[0]))
        except ValueError:
            continue
        if cls in keep_indices:
            out_lines.append(" ".join(["0"] + parts[1:]))
    return out_lines


def process_dataset(dataset_dir: Path, dry_run: bool, counters: dict) -> None:
    yaml_path = dataset_dir / "data.yaml"
    if not yaml_path.exists():
        print(f"  ⚠️ data.yaml 없음 — 건너뜀: {dataset_dir.name}")
        return

    names = parse_names_from_yaml(yaml_path)
    if not names:
        print(f"  ⚠️ names 를 못 읽음 — 건너뜀: {dataset_dir.name}")
        return

    # 각 클래스 인덱스가 네잎인지 판정.
    keep_indices = set()
    print(f"\n📂 {dataset_dir.name}  (클래스 {len(names)}개)")
    for idx, name in enumerate(names):
        four = is_four_leaf(name)
        ambiguous = normalize(name) == "clover"  # 개수 표시 없는 애매한 이름
        mark = "✅ 유지→four_leaf" if four else "🚫 제거"
        warn = "  ⚠️(개수 불명확 — 확인 권장)" if (four and ambiguous) else ""
        print(f"    [{idx}] {name!r:20} → {mark}{warn}")
        if four:
            keep_indices.add(idx)

    if not keep_indices:
        print("    ⚠️ 네잎으로 판정된 클래스가 없습니다. CLASS_OVERRIDES 로 지정하세요.")
        return

    src_prefix = normalize(dataset_dir.name)  # 파일명 충돌 방지용 접두어

    for split in SPLITS:
        sdir = find_split_dir(dataset_dir, split)
        if not sdir:
            continue
        img_out = MERGED_DIR / split / "images"
        lbl_out = MERGED_DIR / split / "labels"
        if not dry_run:
            img_out.mkdir(parents=True, exist_ok=True)
            lbl_out.mkdir(parents=True, exist_ok=True)

        images = [p for p in (sdir / "images").iterdir() if p.suffix.lower() in IMAGE_EXTS]
        for img in images:
            label = sdir / "labels" / (img.stem + ".txt")
            kept_lines = remap_label_file(label, keep_indices) if label.exists() else []

            new_stem = f"{src_prefix}__{img.stem}"
            counters[split]["images"] += 1
            counters[split]["boxes"] += len(kept_lines)
            if len(kept_lines) == 0:
                counters[split]["background"] += 1

            if dry_run:
                continue

            shutil.copy2(img, img_out / (new_stem + img.suffix))
            # 박스가 0개여도 빈 라벨 파일을 만들어 배경(하드 네거티브)으로 학습시킨다.
            (lbl_out / (new_stem + ".txt")).write_text(
                "\n".join(kept_lines), encoding="utf-8"
            )


def write_merged_yaml() -> None:
    """병합 결과의 data.yaml 생성 (단일 클래스)."""
    lines = []
    for split, key in [("train", "train"), ("valid", "val"), ("test", "test")]:
        if (MERGED_DIR / split / "images").is_dir():
            lines.append(f"{key}: {split}/images")
    lines.append("")
    lines.append("nc: 1")
    lines.append(f"names: ['{TARGET_CLASS}']")
    (MERGED_DIR / "data.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="YOLO 클로버 데이터셋 병합")
    parser.add_argument("--dry-run", action="store_true", help="복사 없이 판정 결과만 출력")
    args = parser.parse_args()

    if not RAW_DIR.exists() or not any(RAW_DIR.iterdir()):
        print(f"❌ {RAW_DIR} 가 비어 있습니다. 먼저 download_datasets.py 를 실행하세요.")
        sys.exit(1)

    if MERGED_DIR.exists() and not args.dry_run:
        print(f"🧹 기존 merged/ 삭제 후 재생성: {MERGED_DIR}")
        shutil.rmtree(MERGED_DIR)

    counters = {s: {"images": 0, "boxes": 0, "background": 0} for s in SPLITS}

    dataset_dirs = [d for d in sorted(RAW_DIR.iterdir()) if d.is_dir()]
    print(f"🔗 병합 대상: {len(dataset_dirs)}개 데이터셋")
    for d in dataset_dirs:
        process_dataset(d, args.dry_run, counters)

    print("\n" + "=" * 52)
    print("📊 병합 결과" + ("  (DRY-RUN — 실제 복사 안 함)" if args.dry_run else ""))
    print("=" * 52)
    total_img = total_box = 0
    for split in SPLITS:
        c = counters[split]
        total_img += c["images"]
        total_box += c["boxes"]
        if c["images"]:
            print(
                f"  {split:6} : 이미지 {c['images']:4}장 / "
                f"네잎박스 {c['boxes']:4}개 / 배경 {c['background']:4}장"
            )
    print("-" * 52)
    print(f"  합계   : 이미지 {total_img}장 / 네잎박스 {total_box}개")
    print("=" * 52)

    if args.dry_run:
        print("\n👉 판정이 맞으면 --dry-run 없이 다시 실행하세요.")
        return

    if total_img == 0:
        print("\n❌ 복사된 이미지가 없습니다. 데이터셋 구조를 확인하세요.")
        sys.exit(1)

    write_merged_yaml()
    print(f"\n✅ 완료 → {MERGED_DIR}")
    print(f"   data.yaml 생성됨 (단일 클래스 '{TARGET_CLASS}')")
    print("\n👉 다음 단계: merged/ 폴더를 zip 으로 묶어 Colab(train_yolo.ipynb) 에 업로드")


if __name__ == "__main__":
    main()
