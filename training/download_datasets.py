"""
Hello Lucky - Roboflow Universe 공개 클로버 데이터셋 다운로드

목표:
  라벨링(박스 그리기) 작업 없이, 이미 박스가 그려진 공개 데이터셋을
  YOLO 포맷으로 내려받아 학습 재료를 즉시 확보한다.

전체 흐름:
  1. download_datasets.py   → 공개 데이터셋 3개를 YOLO 포맷으로 다운로드
  2. merge_datasets.py      → 클래스 이름을 'four_leaf' 하나로 통일해 병합
  3. train_yolo.ipynb       → Colab 무료 GPU 에서 YOLOv8n 학습
  4. (배포) 학습한 모델을 Roboflow 에 올리거나 TFLite 로 변환

사용법:
  pip install roboflow
  # .env 에 ROBOFLOW_API_KEY 설정 (무료 계정이면 충분)
  python training/download_datasets.py

주의:
  아래 DATASETS 의 version 번호는 시점에 따라 달라질 수 있습니다.
  다운로드가 404 로 실패하면, 각 데이터셋 페이지의
  "Download this Dataset" 버튼이 알려주는 workspace/project/version 로
  아래 값을 교체하세요. (스크립트가 실패 시 그 안내를 출력합니다.)
"""

import os
import sys
from pathlib import Path

# Windows 콘솔(cp949)에서도 이모지가 깨지지 않도록 UTF-8 출력으로 전환.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    from dotenv import load_dotenv

    # 프로젝트 루트의 .env 를 읽는다 (training/ 의 부모).
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    print("ℹ️  python-dotenv 미설치 — .env 자동 로드를 건너뜁니다. (pip install python-dotenv)")

# ============================
# 설정
# ============================
ROBOFLOW_API_KEY = (
    os.getenv("ROBOFLOW_API_KEY")
    or os.getenv("EXPO_PUBLIC_ROBOFLOW_API_KEY")
    or ""
)

# YOLO 내보내기 포맷. ultralytics YOLOv8/YOLOv11 학습과 호환.
EXPORT_FORMAT = os.getenv("ROBOFLOW_EXPORT_FORMAT", "yolov8")

# 다운로드 위치 (병합 스크립트가 여기서 읽어감).
RAW_DIR = Path(__file__).resolve().parent / "datasets_raw"

# 내려받을 공개 데이터셋 목록.
#   workspace / project / version 은 각 데이터셋 페이지의
#   "Download this Dataset" 코드 스니펫에서 그대로 복사한 값이어야 정확합니다.
#   여기 값들은 조사 시점 기준의 추정치이므로, 실패하면 교체하세요.
DATASETS = [
    # version=None → 최신 버전 자동 선택. 라이선스는 2026-10 조사 기준.
    # 제외: nobug/findclover (4-leaf-clover-detect 의 부분 복사본, 클래스 번호만 뒤바뀜),
    #       workspace-lgnet/four-leaf-clovers (공개 버전 없음 → 다운로드 불가).
    {"name": "solucky", "workspace": "benn-witt", "project": "solucky", "version": None,
     "note": "Public Domain"},
    {"name": "hunting-for-four-leaf-clovers", "workspace": "adam-fonagy", "project": "hunting-for-four-leaf-clovers", "version": None,
     "note": "CC BY 4.0 (앱 설정 화면에 출처 표기)"},
    {"name": "4-leaf-clover-detect", "workspace": "test-ara07", "project": "4-leaf-clover-detect", "version": None,
     "note": "CC BY 4.0 (앱 설정 화면에 출처 표기)"},
]


def require_api_key():
    if not ROBOFLOW_API_KEY:
        print(
            "❌ ROBOFLOW_API_KEY 가 없습니다.\n"
            "   .env 에 ROBOFLOW_API_KEY=... 를 넣거나 환경변수로 설정하세요.\n"
            "   키 발급(무료): https://app.roboflow.com/settings/api"
        )
        sys.exit(1)


def require_roboflow():
    try:
        from roboflow import Roboflow  # noqa: F401
    except ImportError:
        print(
            "❌ roboflow 패키지가 없습니다.\n"
            "   설치:  pip install roboflow\n"
        )
        sys.exit(1)


def download_one(rf, spec: dict) -> bool:
    """데이터셋 하나를 내려받는다. 성공하면 True."""
    name = spec["name"]
    dest = RAW_DIR / name
    print(f"\n📦 {name}  (v{spec['version'] or 'latest'}) — {spec.get('note', '')}")

    if dest.exists() and any(dest.iterdir()):
        print(f"  ⏭️  이미 존재: {dest}  (건너뜀 — 다시 받으려면 폴더 삭제)")
        return True

    try:
        project = (
            rf.workspace(spec["workspace"])
            .project(spec["project"])
        )
        number = spec["version"]
        if number is None:
            # 버전 id 는 "workspace/project/N" 형태 → 가장 큰 N 선택.
            number = max(int(str(v.version).rstrip("/").split("/")[-1]) for v in project.versions())
        version = project.version(number)
        version.download(EXPORT_FORMAT, location=str(dest))
        print(f"  ✅ 다운로드 완료 → {dest}")
        return True
    except Exception as e:  # roboflow 는 다양한 예외를 던짐
        print(
            f"  ❌ 실패: {e}\n"
            f"     → https://universe.roboflow.com/{spec['workspace']}/{spec['project']}\n"
            f"       페이지의 'Download this Dataset' 스니펫에서\n"
            f"       workspace/project/version 을 확인해 DATASETS 값을 교체하세요."
        )
        return False


def main():
    require_api_key()
    require_roboflow()
    from roboflow import Roboflow

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)

    print(f"🎯 대상: {len(DATASETS)}개 데이터셋 → {RAW_DIR}")
    ok = 0
    for spec in DATASETS:
        if download_one(rf, spec):
            ok += 1

    print("\n" + "=" * 48)
    print(f"📊 완료: {ok}/{len(DATASETS)} 성공")
    print("=" * 48)
    if ok == 0:
        print("👉 모두 실패했습니다. DATASETS 의 version 번호를 확인하세요.")
        sys.exit(1)
    print("👉 다음 단계:  python training/merge_datasets.py")


if __name__ == "__main__":
    main()
