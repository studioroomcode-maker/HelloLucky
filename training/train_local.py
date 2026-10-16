"""
Hello Lucky - 로컬 GPU 로 네잎 감지 모델 학습 (Colab 대신)

전제: download_datasets.py → merge_datasets.py 로 training/merged/ 가 만들어져 있음.

이 스크립트가 하는 일:
  1. merged/ 를 work/ 로 복사하고
  2. clover_dataset/three_leaf 사진을 '네잎 없음' 배경(하드 네거티브)으로 train 에 추가
  3. valid 가 너무 작으면 train 에서 원본 사진 단위로 떼어 검증셋을 만듦
     (Roboflow 증강본 'xxx.rf.<hash>' 은 같은 원본끼리 같은 쪽에 두어 누수 방지)
  4. YOLOv8n 학습 (클로버는 위에서 보면 방향이 없으므로 회전·상하반전 증강)
  5. 결과 지표 출력 → 다음 단계: training/export_tflite.sh

사용법:
  python training/train_local.py --epochs 120
"""
import argparse
import random
import re
import shutil
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
MERGED = BASE / "merged"
WORK = BASE / "work"
# Hard negatives: own three-leaf shots + iNaturalist lookalikes (training/fetch_negatives.py; its holdout stays out).
NEGATIVES = [BASE.parent / "clover_dataset" / d for d in ("three_leaf", "negatives_inat")]
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MIN_VALID = 80


def source_key(stem: str) -> str:
    """Roboflow 증강본(foo_jpg.rf.abc123)을 원본 단위로 묶는 키."""
    return re.sub(r"\.rf\.[0-9a-f]+$", "", stem)


def images_in(split: str) -> list[Path]:
    d = WORK / split / "images"
    return sorted(p for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS) if d.is_dir() else []


def move_pair(img: Path, split: str) -> None:
    for sub, src in (("images", img), ("labels", img.parent.parent / "labels" / f"{img.stem}.txt")):
        dst = WORK / split / sub
        dst.mkdir(parents=True, exist_ok=True)
        if src.exists():
            shutil.move(str(src), dst / src.name)


def prepare(seed: int) -> Path:
    if not (MERGED / "data.yaml").exists():
        sys.exit("❌ training/merged/ 가 없습니다. download_datasets.py → merge_datasets.py 를 먼저 실행하세요.")
    # Windows can keep an empty dir locked (e.g. a shell's cwd); files still go, so tolerate that.
    shutil.rmtree(WORK, ignore_errors=True)
    if any(p.is_file() for p in WORK.rglob("*")):
        sys.exit(f"❌ {WORK} 를 비우지 못했습니다. 사용 중인 프로그램을 닫고 다시 실행하세요.")
    shutil.copytree(MERGED, WORK, dirs_exist_ok=True)

    # 검증셋 보장 (원본 단위 그룹 분할).
    if len(images_in("valid")) < MIN_VALID:
        groups: dict[str, list[Path]] = {}
        for img in images_in("train"):
            groups.setdefault(source_key(img.stem), []).append(img)
        keys = sorted(groups)
        random.Random(seed).shuffle(keys)
        moved = 0
        for key in keys:
            if moved >= max(MIN_VALID, len(images_in("train")) * 0.15):
                break
            for img in groups[key]:
                move_pair(img, "valid")
                moved += 1
        print(f"🔀 train → valid 로 {moved}장 이동 (원본 단위)")

    # 하드 네거티브: 세잎 클로버 밭 사진 (빈 라벨).
    negs = sorted(p for d in NEGATIVES if d.is_dir() for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if negs:
        for img in negs:
            shutil.copy2(img, WORK / "train" / "images" / f"neg__{img.name}")
            (WORK / "train" / "labels" / f"neg__{img.stem}.txt").write_text("", encoding="utf-8")
        print(f"➕ 하드 네거티브 {len(negs)}장 추가")

    yaml = WORK / "data.yaml"
    lines = [f"path: {WORK.as_posix()}", "train: train/images", "val: valid/images"]
    if images_in("test"):
        lines.append("test: test/images")
    lines += ["nc: 2", "names: ['four_leaf', 'three_leaf']"]
    yaml.write_text("\n".join(lines) + "\n", encoding="utf-8")

    for split in ("train", "valid", "test"):
        imgs = images_in(split)
        boxes = sum(
            len((WORK / split / "labels" / f"{p.stem}.txt").read_text().split("\n"))
            for p in imgs
            if (WORK / split / "labels" / f"{p.stem}.txt").exists()
            and (WORK / split / "labels" / f"{p.stem}.txt").read_text().strip()
        )
        print(f"   {split:5}: {len(imgs):5} images, {boxes:5} boxes")
    return yaml


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=120)
    parser.add_argument("--imgsz", type=int, default=960)  # src/config/detector.ts INPUT_SIZE 와 일치
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    from ultralytics import YOLO

    data = prepare(args.seed)
    model = YOLO(args.model)
    model.train(
        data=str(data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=30,
        device=0,
        workers=4,
        seed=args.seed,
        project=str(BASE / "runs"),
        name="clover",
        exist_ok=True,
        # 위에서 내려다본 클로버는 방향이 없다.
        degrees=180,
        flipud=0.5,
        fliplr=0.5,
        scale=0.6,
        mosaic=1.0,
        close_mosaic=15,
    )
    metrics = YOLO(BASE / "runs" / "clover" / "weights" / "best.pt").val(data=str(data), imgsz=args.imgsz, device=0)
    print(f"\n✅ valid  mAP50={metrics.box.map50:.3f}  mAP50-95={metrics.box.map:.3f}  "
          f"P={metrics.box.mp:.3f}  R={metrics.box.mr:.3f}")
    print("다음: bash training/export_tflite.sh  (WSL 에서 tflite 변환 → assets/model/clover.tflite)")


if __name__ == "__main__":
    main()
