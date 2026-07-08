"""
Hello Lucky - 네잎클로버 물체감지(Object Detection) 데이터셋 파이프라인

이 스크립트는 "박스 라벨링 워크플로우"에 맞춰져 있습니다.
분류(classification)가 아니라, 네잎클로버의 위치를 박스로 찾는
object-detection 모델을 만들기 위한 전 단계입니다.

전체 흐름:
  1. iNaturalist에서 네잎(positive) / 세잎(hard negative) 이미지 수집
  2. Roboflow에 object-detection 프로젝트 생성
  3. 이미지를 업로드 (Annotate 큐의 batch 로 들어감)
  4. 로컬 라벨 파일(labels/*.xml 또는 *.txt)이 있으면 박스를 함께 부착
  5. Roboflow Annotate 에서 나머지 박스를 그리고 → 버전 생성 → Train

중요: iNaturalist 이미지에는 박스 좌표가 없습니다.
따라서 네잎클로버 박스는 (a) Roboflow Annotate 웹에서 직접 그리거나,
(b) LabelImg/CVAT 등으로 로컬에서 그린 뒤 이 스크립트가 업로드합니다.

사용법:
  1. pip install requests python-dotenv
  2. .env 에 ROBOFLOW_API_KEY (또는 EXPO_PUBLIC_ROBOFLOW_API_KEY) 설정
  3. python collect_and_train.py                # 수집 + 업로드
     python collect_and_train.py --no-collect   # 이미 받은 이미지만 업로드
     python collect_and_train.py --no-upload    # 수집만
"""

import os
import sys
import time
import argparse
from pathlib import Path

import requests

# Windows 콘솔(cp949)에서도 이모지가 깨지지 않도록 UTF-8 출력으로 전환.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    print("ℹ️  python-dotenv 미설치 — .env 자동 로드를 건너뜁니다. (pip install python-dotenv)")

# ============================
# 설정
# ============================
# API 키는 하드코딩하지 않습니다. .env 또는 환경변수에서 읽습니다.
# (기존 스크립트에 하드코딩됐던 키는 git 이력에 남아있으므로 Roboflow 에서 폐기/재발급하세요.)
ROBOFLOW_API_KEY = (
    os.getenv("ROBOFLOW_API_KEY")
    or os.getenv("EXPO_PUBLIC_ROBOFLOW_API_KEY")
    or ""
)
ROBOFLOW_WORKSPACE = os.getenv("ROBOFLOW_WORKSPACE", "hellolucky")
ROBOFLOW_PROJECT = os.getenv("ROBOFLOW_PROJECT", "hellolucky")  # 업로드 대상 프로젝트 slug

# object-detection 에서 박스에 붙일 클래스 이름.
# 앱의 .env(EXPO_PUBLIC_ROBOFLOW_TARGET_LABELS) 와 일치해야 감지 결과가 필터링을 통과합니다.
TARGET_CLASS = os.getenv("ROBOFLOW_TARGET_CLASS", "four_leaf")

# 수집할 이미지 수 (각 클래스별). 0 으로 두면 해당 클래스는 건너뜀.
FOUR_LEAF_COUNT = int(os.getenv("FOUR_LEAF_COUNT", "200"))   # 네잎 (박스 라벨 대상)
THREE_LEAF_COUNT = int(os.getenv("THREE_LEAF_COUNT", "200"))  # 세잎 (박스 없는 배경/네거티브)

# 업로드 배치 이름 — Roboflow Annotate 에서 이 이름으로 묶여 보입니다.
UPLOAD_BATCH = os.getenv("ROBOFLOW_UPLOAD_BATCH", "auto-import")

# 폴더 구조
SAVE_DIR = Path("./clover_dataset")
FOUR_LEAF_DIR = SAVE_DIR / "four_leaf"
THREE_LEAF_DIR = SAVE_DIR / "three_leaf"
LABELS_DIR = SAVE_DIR / "labels"  # 선택: {이미지이름}.xml(VOC) 또는 .txt(YOLO)

API_BASE = "https://api.roboflow.com"

# ============================
# iNaturalist 검색어
# ============================
SEARCH_QUERIES = {
    "four_leaf": [
        "four-leaf clover",
        "four leaf clover",
        "Trifolium repens quadrifolium",  # 학명
    ],
    "three_leaf": [
        "white clover",
        "Trifolium repens",  # 학명
        "three leaf clover",
    ],
}


def require_api_key():
    if not ROBOFLOW_API_KEY:
        print(
            "❌ ROBOFLOW_API_KEY 가 없습니다.\n"
            "   .env 에 ROBOFLOW_API_KEY=... 를 넣거나 환경변수로 설정하세요.\n"
            "   키 발급: https://app.roboflow.com/settings/api"
        )
        sys.exit(1)


def setup_dirs():
    FOUR_LEAF_DIR.mkdir(parents=True, exist_ok=True)
    THREE_LEAF_DIR.mkdir(parents=True, exist_ok=True)
    print("✅ 폴더 준비 완료")


# ----------------------------
# 1) 이미지 수집 (iNaturalist)
# ----------------------------
def fetch_inaturalist_images(query: str, count: int, save_dir: Path, label: str):
    """iNaturalist 에서 연구등급 관찰 사진을 수집."""
    print(f"\n🔍 '{query}' 검색 중... (목표: {count}장)")
    collected = 0
    page = 1

    while collected < count:
        try:
            res = requests.get(
                "https://api.inaturalist.org/v1/observations",
                params={
                    "q": query,
                    "photos": "true",
                    "per_page": 50,
                    "page": page,
                    "order": "desc",
                    "order_by": "votes",
                    "quality_grade": "research",
                },
                timeout=10,
            )
            results = res.json().get("results", [])
            if not results:
                print(f"  더 이상 결과 없음 (page {page})")
                break

            for obs in results:
                if collected >= count:
                    break
                for photo in obs.get("photos", []):
                    if collected >= count:
                        break
                    img_url = photo.get("url", "").replace("square", "large")
                    if not img_url:
                        continue
                    try:
                        img_res = requests.get(img_url, timeout=10)
                        if img_res.status_code != 200:
                            continue
                        filename = save_dir / f"{label}_{collected + 1:04d}.jpg"
                        filename.write_bytes(img_res.content)
                        collected += 1
                        print(f"  📥 {collected}/{count} {filename.name}")
                        time.sleep(0.3)
                    except Exception as e:
                        print(f"  ⚠️ 다운로드 실패: {e}")

            page += 1
            time.sleep(1)
        except Exception as e:
            print(f"  ❌ API 오류: {e}")
            time.sleep(3)

    print(f"  ✅ '{label}' {collected}장 수집")
    return collected


def collect_all():
    for query in SEARCH_QUERIES["four_leaf"]:
        remaining = FOUR_LEAF_COUNT - len(list(FOUR_LEAF_DIR.glob("*.jpg")))
        if remaining <= 0:
            break
        fetch_inaturalist_images(query, remaining, FOUR_LEAF_DIR, "four_leaf")

    for query in SEARCH_QUERIES["three_leaf"]:
        remaining = THREE_LEAF_COUNT - len(list(THREE_LEAF_DIR.glob("*.jpg")))
        if remaining <= 0:
            break
        fetch_inaturalist_images(query, remaining, THREE_LEAF_DIR, "three_leaf")


# ----------------------------
# 2) Roboflow object-detection 프로젝트 생성
# ----------------------------
def create_object_detection_project():
    print("\n🏗️  Roboflow object-detection 프로젝트 확인/생성...")
    try:
        res = requests.post(
            f"{API_BASE}/{ROBOFLOW_WORKSPACE}/projects",
            params={"api_key": ROBOFLOW_API_KEY},
            json={
                "name": "Hello Lucky Clover",
                "type": "object-detection",  # ← 분류가 아니라 물체감지
                "annotation": TARGET_CLASS,   # 어노테이션 그룹 이름
            },
            timeout=30,
        )
        if res.status_code in (200, 201):
            print("  ✅ 프로젝트 생성 완료 (object-detection)")
        elif res.status_code == 409:
            print("  ℹ️ 이미 존재하는 프로젝트 — 계속 진행")
        else:
            print(f"  ⚠️ 생성 응답 {res.status_code}: {res.text[:200]}")
            print("     (웹에서 직접 object-detection 프로젝트를 만들어도 됩니다)")
    except Exception as e:
        print(f"  ⚠️ 프로젝트 생성 건너뜀: {e}")


# ----------------------------
# 3) 이미지 업로드 → image id 반환
# ----------------------------
def upload_image(img_path: Path, split: str, tag: str) -> str | None:
    url = f"{API_BASE}/dataset/{ROBOFLOW_PROJECT}/upload"
    with open(img_path, "rb") as f:
        res = requests.post(
            url,
            params={
                "api_key": ROBOFLOW_API_KEY,
                "name": img_path.name,
                "split": split,
                "batch": UPLOAD_BATCH,
                "tag": tag,
            },
            files={"file": (img_path.name, f, "image/jpeg")},
            timeout=60,
        )
    if res.status_code != 200:
        print(f"  ⚠️ 업로드 실패 {img_path.name}: {res.text[:150]}")
        return None
    data = res.json()
    return data.get("id") or data.get("image", {}).get("id")


# ----------------------------
# 4) 로컬 박스 라벨 부착 (있을 때만)
# ----------------------------
def find_local_annotation(img_path: Path) -> Path | None:
    """labels/{stem}.xml (Pascal VOC) 또는 labels/{stem}.txt (YOLO) 를 찾음."""
    for ext in (".xml", ".txt"):
        candidate = LABELS_DIR / (img_path.stem + ext)
        if candidate.exists():
            return candidate
    return None


def upload_annotation(image_id: str, label_path: Path) -> bool:
    url = f"{API_BASE}/dataset/{ROBOFLOW_PROJECT}/annotate/{image_id}"
    res = requests.post(
        url,
        params={
            "api_key": ROBOFLOW_API_KEY,
            "name": label_path.name,
            "overwrite": "true",
        },
        data=label_path.read_bytes(),
        headers={"Content-Type": "text/plain"},
        timeout=60,
    )
    if res.status_code != 200:
        print(f"  ⚠️ 라벨 부착 실패 {label_path.name}: {res.text[:150]}")
        return False
    return True


def upload_dir(image_dir: Path, tag: str):
    images = sorted(image_dir.glob("*.jpg"))
    if not images:
        print(f"  (건너뜀: {image_dir} 에 이미지 없음)")
        return 0, 0

    print(f"\n📤 '{tag}' 업로드 중... ({len(images)}장)")
    uploaded, annotated = 0, 0
    for img_path in images:
        image_id = upload_image(img_path, split="train", tag=tag)
        if not image_id:
            continue
        uploaded += 1

        label_path = find_local_annotation(img_path)
        if label_path and upload_annotation(image_id, label_path):
            annotated += 1
            print(f"  ✅ {uploaded}/{len(images)} {img_path.name}  (＋박스 {label_path.suffix})")
        else:
            print(f"  ✅ {uploaded}/{len(images)} {img_path.name}  (박스 미부착 → 웹에서 라벨링)")
        time.sleep(0.4)

    print(f"  🎉 '{tag}' 업로드 {uploaded}장, 로컬박스 부착 {annotated}장")
    return uploaded, annotated


# ----------------------------
# 메인
# ----------------------------
def print_next_steps():
    project_url = f"https://app.roboflow.com/{ROBOFLOW_WORKSPACE}/{ROBOFLOW_PROJECT}"
    print("\n" + "=" * 56)
    print("📋 다음 단계 (박스 라벨링 → 학습)")
    print("=" * 56)
    print(f"1. {project_url}/annotate 접속 → batch '{UPLOAD_BATCH}' 열기")
    print(f"2. 네잎(four_leaf) 이미지: 각 네잎클로버에 박스를 그리고")
    print(f"   클래스 이름을 정확히 '{TARGET_CLASS}' 로 지정 (앱 .env 와 일치해야 함)")
    print("3. 세잎(background) 이미지: 박스 없이 'Mark as Null' 로 배경 처리")
    print("   → 오탐(false positive)을 줄이는 hard negative 역할")
    print("4. Generate → 새 버전 생성 (Train/Valid/Test 자동 분할)")
    print("5. Train Model 클릭 → 학습 완료되면 모델 ID 확인 (예: hellolucky/3)")
    print("6. 앱 .env 에 입력:")
    print("     EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID=hellolucky/<버전>")
    print("     EXPO_PUBLIC_ROBOFLOW_API_KEY=<키>")
    print("=" * 56)


def main():
    parser = argparse.ArgumentParser(description="Hello Lucky object-detection 데이터 파이프라인")
    parser.add_argument("--no-collect", action="store_true", help="iNaturalist 수집 건너뛰기")
    parser.add_argument("--no-upload", action="store_true", help="Roboflow 업로드 건너뛰기")
    args = parser.parse_args()

    print("=" * 56)
    print("🍀 Hello Lucky - object-detection 데이터셋 파이프라인")
    print("=" * 56)

    setup_dirs()

    if not args.no_collect:
        collect_all()
    else:
        print("⏭️  수집 건너뜀 (--no-collect)")

    four = len(list(FOUR_LEAF_DIR.glob("*.jpg")))
    three = len(list(THREE_LEAF_DIR.glob("*.jpg")))
    print(f"\n📊 로컬 이미지 — 네잎 {four}장 / 세잎(배경) {three}장")

    if args.no_upload:
        print("⏭️  업로드 건너뜀 (--no-upload)")
        return

    require_api_key()
    create_object_detection_project()
    upload_dir(FOUR_LEAF_DIR, tag="four_leaf")
    upload_dir(THREE_LEAF_DIR, tag="background")
    print_next_steps()


if __name__ == "__main__":
    main()
