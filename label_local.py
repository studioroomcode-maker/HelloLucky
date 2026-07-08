"""
Hello Lucky - 로컬 박스 라벨링 도우미

네잎클로버 이미지에 로컬 도구(LabelImg)로 박스를 그리고,
업로드 전에 라벨을 검증하는 스크립트입니다.

전체 그림:
  1. collect_and_train.py  → 이미지 수집 (clover_dataset/four_leaf)
  2. label_local.py launch → LabelImg 로 네잎에 박스 그리기 (labels/ 에 저장)
  3. label_local.py check  → 라벨 형식/클래스 이름 검증
  4. collect_and_train.py --no-collect → 이미지+박스 Roboflow 업로드

사용법:
  pip install labelImg          # 라벨링 도구 (PyQt 기반)
  python label_local.py launch  # 네잎 폴더 열기 (박스 → 저장은 Pascal VOC 권장)
  python label_local.py check   # 라벨 검증
"""

import sys
import argparse
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

# Windows 콘솔(cp949)에서도 이모지가 깨지지 않도록 UTF-8 출력으로 전환.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SAVE_DIR = Path("./clover_dataset")
FOUR_LEAF_DIR = SAVE_DIR / "four_leaf"       # 박스를 그릴 대상 (positive)
THREE_LEAF_DIR = SAVE_DIR / "three_leaf"     # 배경 (박스 없어야 함)
LABELS_DIR = SAVE_DIR / "labels"             # 라벨 저장 위치
CLASSES_FILE = SAVE_DIR / "predefined_classes.txt"

# 앱 .env(EXPO_PUBLIC_ROBOFLOW_TARGET_LABELS) 와 반드시 일치해야 하는 클래스 이름.
TARGET_CLASS = "four_leaf"


# ----------------------------
# launch: LabelImg 실행
# ----------------------------
def launch():
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    images = list(FOUR_LEAF_DIR.glob("*.jpg"))
    if not images:
        print(f"❌ {FOUR_LEAF_DIR} 에 이미지가 없습니다. 먼저 collect_and_train.py 를 실행하세요.")
        sys.exit(1)

    print(f"🖼️  LabelImg 실행 — {len(images)}장")
    print(f"   저장 위치: {LABELS_DIR}")
    print(f"   클래스: {TARGET_CLASS} (predefined_classes.txt 에서 자동 로드)")
    print("   TIP: 좌하단 포맷을 'PascalVOC' 로 두고, 각 네잎에 박스 → Ctrl+S 저장")
    print("        단축키:  W=박스 그리기  D=다음  A=이전\n")

    # labelImg [IMAGE_DIR] [PREDEFINED_CLASS_FILE] [SAVE_DIR]
    cmd = ["labelImg", str(FOUR_LEAF_DIR), str(CLASSES_FILE), str(LABELS_DIR)]
    try:
        subprocess.run(cmd, check=False)
    except FileNotFoundError:
        print(
            "❌ labelImg 를 찾을 수 없습니다.\n"
            "   설치:  pip install labelImg\n"
            "   (안 되면 Roboflow 웹 Annotate 로 라벨링해도 됩니다)"
        )
        sys.exit(1)


# ----------------------------
# check: 라벨 검증
# ----------------------------
def load_yolo_classes() -> list[str]:
    """LabelImg 가 YOLO 모드에서 저장하는 labels/classes.txt 를 읽음."""
    f = LABELS_DIR / "classes.txt"
    if f.exists():
        return [line.strip() for line in f.read_text(encoding="utf-8").splitlines() if line.strip()]
    return []


def check_voc(xml_path: Path) -> tuple[int, list[str]]:
    """VOC XML → (박스 개수, 잘못된 클래스 이름 목록)"""
    try:
        root = ET.parse(xml_path).getroot()
    except ET.ParseError as e:
        return -1, [f"XML 파싱 오류: {e}"]
    names = [obj.findtext("name", "").strip() for obj in root.findall("object")]
    bad = [n for n in names if n != TARGET_CLASS]
    return len(names), bad


def check_yolo(txt_path: Path, classes: list[str]) -> tuple[int, list[str]]:
    """YOLO txt → (박스 개수, 잘못된 클래스 이름 목록)"""
    lines = [l for l in txt_path.read_text(encoding="utf-8").splitlines() if l.strip()]
    bad = []
    for l in lines:
        idx = l.split()[0]
        name = classes[int(idx)] if idx.isdigit() and int(idx) < len(classes) else f"idx:{idx}"
        if name != TARGET_CLASS:
            bad.append(name)
    return len(lines), bad


def check():
    if not LABELS_DIR.exists():
        print(f"❌ {LABELS_DIR} 없음 — 아직 라벨이 없습니다. label_local.py launch 먼저.")
        sys.exit(1)

    yolo_classes = load_yolo_classes()
    four_images = sorted(FOUR_LEAF_DIR.glob("*.jpg"))

    labeled, empty, missing, bad_class = 0, 0, 0, 0
    total_boxes = 0

    print(f"🔎 네잎 이미지 {len(four_images)}장 라벨 검증...\n")
    for img in four_images:
        xml = LABELS_DIR / (img.stem + ".xml")
        txt = LABELS_DIR / (img.stem + ".txt")

        if xml.exists():
            count, bad = check_voc(xml)
        elif txt.exists():
            count, bad = check_yolo(txt, yolo_classes)
        else:
            missing += 1
            print(f"  ⬜ 라벨 없음: {img.name}  (박스 없이 업로드됨)")
            continue

        if count == 0:
            empty += 1
            print(f"  ⚠️ 박스 0개: {img.name}")
        elif bad:
            bad_class += 1
            print(f"  ❌ 클래스 이름 오류: {img.name} → {sorted(set(bad))} (기대값 '{TARGET_CLASS}')")
        else:
            labeled += 1
            total_boxes += count

    # 배경(세잎)은 박스가 없어야 정상 — 실수로 라벨 붙었는지 확인
    stray = [img.name for img in THREE_LEAF_DIR.glob("*.jpg")
             if (LABELS_DIR / (img.stem + ".xml")).exists() or (LABELS_DIR / (img.stem + ".txt")).exists()]

    print("\n" + "=" * 48)
    print("📊 검증 결과")
    print("=" * 48)
    print(f"  ✅ 정상 라벨:      {labeled}장 (박스 {total_boxes}개)")
    print(f"  ⬜ 라벨 없음:      {missing}장")
    print(f"  ⚠️ 박스 0개:       {empty}장")
    print(f"  ❌ 클래스 이름 오류: {bad_class}장")
    if stray:
        print(f"  ⚠️ 배경에 라벨 붙음: {len(stray)}장 {stray[:5]}{'...' if len(stray) > 5 else ''}")
    print("=" * 48)

    if bad_class:
        print(f"\n👉 클래스 이름은 반드시 '{TARGET_CLASS}' 여야 앱의 .env 필터를 통과합니다.")
    if labeled == 0:
        print("\n👉 아직 정상 라벨이 없습니다. label_local.py launch 로 박스를 그리세요.")
    else:
        print("\n👉 준비 완료 → python collect_and_train.py --no-collect 로 업로드")


def main():
    parser = argparse.ArgumentParser(description="Hello Lucky 로컬 박스 라벨링 도우미")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("launch", help="LabelImg 실행 (네잎 폴더)")
    sub.add_parser("check", help="라벨 형식/클래스 이름 검증")
    args = parser.parse_args()

    if args.cmd == "launch":
        launch()
    elif args.cmd == "check":
        check()


if __name__ == "__main__":
    main()
