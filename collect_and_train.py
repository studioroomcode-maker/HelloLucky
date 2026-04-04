"""
Hello Lucky - 클로버 이미지 자동 수집 & Roboflow 업로드 스크립트
iNaturalist에서 네잎/세잎 클로버 이미지를 수집하고 Roboflow에 업로드합니다.

사용법:
1. pip install requests roboflow python-dotenv
2. 아래 API 키 설정
3. python collect_and_train.py 실행
"""

import os
import time
import requests
from pathlib import Path

# ============================
# 설정 (여기만 바꿔주세요!)
# ============================
ROBOFLOW_API_KEY = "SrHm037IKsdy8bbuizi6"
ROBOFLOW_WORKSPACE = "hellolucky"
ROBOFLOW_PROJECT = "hellolucky"  # Roboflow에서 만들 프로젝트 이름

# 수집할 이미지 수 (각 클래스별)
FOUR_LEAF_COUNT = 200   # 네잎클로버
THREE_LEAF_COUNT = 200  # 세잎클로버

# 저장 폴더
SAVE_DIR = Path("./clover_dataset")
FOUR_LEAF_DIR = SAVE_DIR / "four_leaf"
THREE_LEAF_DIR = SAVE_DIR / "three_leaf"

# ============================
# iNaturalist API 검색어
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
    ]
}

def setup_dirs():
    """폴더 생성"""
    FOUR_LEAF_DIR.mkdir(parents=True, exist_ok=True)
    THREE_LEAF_DIR.mkdir(parents=True, exist_ok=True)
    print("✅ 폴더 생성 완료")

def fetch_inaturalist_images(query: str, count: int, save_dir: Path, label: str):
    """iNaturalist에서 이미지 수집"""
    print(f"\n🔍 '{query}' 검색 중... (목표: {count}장)")
    
    collected = 0
    page = 1
    
    while collected < count:
        try:
            # iNaturalist API 호출
            url = "https://api.inaturalist.org/v1/observations"
            params = {
                "q": query,
                "photos": "true",
                "per_page": 50,
                "page": page,
                "order": "votes",
                "order_by": "desc",
                "quality_grade": "research",  # 검증된 관찰만
            }
            
            res = requests.get(url, params=params, timeout=10)
            data = res.json()
            results = data.get("results", [])
            
            if not results:
                print(f"  더 이상 결과 없음 (page {page})")
                break
            
            for obs in results:
                if collected >= count:
                    break
                
                photos = obs.get("photos", [])
                for photo in photos:
                    if collected >= count:
                        break
                    
                    # 원본 이미지 URL
                    img_url = photo.get("url", "").replace("square", "large")
                    if not img_url:
                        continue
                    
                    # 이미지 다운로드
                    try:
                        img_res = requests.get(img_url, timeout=10)
                        if img_res.status_code != 200:
                            continue
                        
                        filename = save_dir / f"{label}_{collected+1:04d}.jpg"
                        with open(filename, "wb") as f:
                            f.write(img_res.content)
                        
                        collected += 1
                        print(f"  📥 {collected}/{count} 저장: {filename.name}")
                        time.sleep(0.3)  # API 과부하 방지
                        
                    except Exception as e:
                        print(f"  ⚠️ 이미지 다운로드 실패: {e}")
                        continue
            
            page += 1
            time.sleep(1)
            
        except Exception as e:
            print(f"  ❌ API 오류: {e}")
            time.sleep(3)
            continue
    
    print(f"  ✅ '{label}' 총 {collected}장 수집 완료!")
    return collected

def upload_to_roboflow(image_dir: Path, label: str):
    """Roboflow에 이미지 업로드"""
    print(f"\n📤 Roboflow에 '{label}' 업로드 중...")
    
    images = list(image_dir.glob("*.jpg"))
    uploaded = 0
    
    for img_path in images:
        try:
            url = f"https://api.roboflow.com/dataset/{ROBOFLOW_PROJECT}/upload"
            
            with open(img_path, "rb") as f:
                res = requests.post(
                    url,
                    params={
                        "api_key": ROBOFLOW_API_KEY,
                        "name": img_path.name,
                        "split": "train",
                        "tag": label,
                    },
                    files={"file": f},
                    timeout=30,
                )
            
            if res.status_code == 200:
                uploaded += 1
                print(f"  ✅ {uploaded}/{len(images)} 업로드: {img_path.name}")
            else:
                print(f"  ⚠️ 업로드 실패: {res.text}")
            
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  ❌ 오류: {e}")
            continue
    
    print(f"  🎉 '{label}' 총 {uploaded}장 업로드 완료!")

def create_roboflow_project():
    """Roboflow 프로젝트 생성"""
    print("\n🏗️ Roboflow 프로젝트 생성 중...")
    
    url = f"https://api.roboflow.com/workspace/{ROBOFLOW_WORKSPACE}/projects"
    res = requests.post(
        url,
        params={"api_key": ROBOFLOW_API_KEY},
        json={
            "name": "Hello Lucky Clover",
            "project_type": "classification",
            "annotation": "classification",
        }
    )
    
    if res.status_code in [200, 201]:
        print("  ✅ 프로젝트 생성 완료!")
    elif res.status_code == 409:
        print("  ℹ️ 프로젝트가 이미 존재해요. 계속 진행합니다.")
    else:
        print(f"  ⚠️ 프로젝트 생성 실패: {res.text}")

def main():
    print("=" * 50)
    print("🍀 Hello Lucky - 클로버 데이터셋 수집 시작!")
    print("=" * 50)
    
    # 1. 폴더 생성
    setup_dirs()
    
    # 2. 네잎클로버 수집
    for query in SEARCH_QUERIES["four_leaf"]:
        remaining = FOUR_LEAF_COUNT - len(list(FOUR_LEAF_DIR.glob("*.jpg")))
        if remaining <= 0:
            break
        fetch_inaturalist_images(query, remaining, FOUR_LEAF_DIR, "four_leaf")
    
    # 3. 세잎클로버 수집
    for query in SEARCH_QUERIES["three_leaf"]:
        remaining = THREE_LEAF_COUNT - len(list(THREE_LEAF_DIR.glob("*.jpg")))
        if remaining <= 0:
            break
        fetch_inaturalist_images(query, remaining, THREE_LEAF_DIR, "three_leaf")
    
    print("\n" + "=" * 50)
    print("📊 수집 결과")
    print(f"  네잎클로버: {len(list(FOUR_LEAF_DIR.glob('*.jpg')))}장")
    print(f"  세잎클로버: {len(list(THREE_LEAF_DIR.glob('*.jpg')))}장")
    print("=" * 50)
    
    # 4. Roboflow 프로젝트 생성
    create_roboflow_project()
    
    # 5. Roboflow 업로드
    upload_to_roboflow(FOUR_LEAF_DIR, "four_leaf")
    upload_to_roboflow(THREE_LEAF_DIR, "three_leaf")
    
    print("\n" + "=" * 50)
    print("🎉 완료! 이제 Roboflow에서 학습을 시작하세요.")
    print("👉 app.roboflow.com 에서 Train Model 버튼을 클릭하세요!")
    print("=" * 50)

if __name__ == "__main__":
    main()
