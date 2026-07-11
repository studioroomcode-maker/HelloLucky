# training/ — 공개 데이터로 클로버 감지 모델 부트스트랩

라벨링(박스 그리기) 작업 없이, Roboflow Universe의 **이미 박스가 그려진 공개
데이터셋**을 받아 YOLOv8n 모델을 학습해 앱을 end-to-end로 검증하기 위한
워크플로우입니다.

## 목적과 한계 (먼저 읽으세요)

- **목적:** "이 아이디어가 실제 폰에서 어느 정도 되는지"를 돈 안 들이고 1~2주 안에 확인.
- **얻는 것:** 동작하는 감지 파이프라인 + **데모 수준** 모델.
- **못 얻는 것:** 상용 정확도. 공개 데이터는 900장 남짓이고 상당수가 근접샷이라
  "서서 클로버 밭을 비추는" 실사용 장면에서는 성능이 떨어집니다.
- **정확도를 올리는 유일한 길:** 실사용 각도의 필드 데이터를 모아 재학습.

## 사전 준비

```bash
pip install roboflow python-dotenv pyyaml
```

프로젝트 루트 `.env`에 Roboflow API 키(무료 계정으로 충분):

```env
ROBOFLOW_API_KEY=your_key_here
```

키 발급: https://app.roboflow.com/settings/api

## 단계

### 1. 공개 데이터셋 다운로드

```bash
python training/download_datasets.py
```

`training/datasets_raw/` 아래로 YOLO 포맷 데이터셋이 받아집니다.

> ⚠️ `download_datasets.py`의 `DATASETS`에 적힌 version 번호는 조사 시점 기준
> 추정치입니다. 404로 실패하면, 각 데이터셋 페이지의 **"Download this Dataset"**
> 버튼이 알려주는 workspace/project/version으로 교체하세요. 스크립트가 실패 시
> 해당 URL을 출력합니다.

> ⚠️ **라이선스는 데이터셋마다 다릅니다.** 상용화가 목표라면 세 데이터셋 각각의
> 라이선스(CC BY 4.0 등)를 페이지에서 확인하세요.

### 2. 하나로 병합 (클래스 통일)

```bash
python training/merge_datasets.py --dry-run   # 먼저 판정 결과만 확인
python training/merge_datasets.py             # 실제 병합
```

데이터셋마다 다른 클래스 이름(`clover-4`, `4-leaf` 등)을 **`four_leaf` 하나로
통일**합니다. 이게 중요한 이유: 앱의 `cloverDetection.ts` 필터는 `four_leaf`
계열 이름만 통과시키므로, 학습 클래스명이 다르면 감지 결과가 앱에서 전부
걸러집니다.

`--dry-run`이 출력하는 **판정 표를 반드시 눈으로 확인**하세요. 세잎/배경 박스는
자동 제거되고 그 이미지는 배경(하드 네거티브)으로 활용됩니다. 애매한 이름은
`merge_datasets.py`의 `CLASS_OVERRIDES`로 직접 지정할 수 있습니다.

결과: `training/merged/` (train/valid/test + 단일 클래스 `data.yaml`)

### 3. Colab에서 학습

`training/merged/`를 zip으로 압축:

```powershell
Compress-Archive -Path training/merged/* -DestinationPath merged.zip
```

`train_yolo.ipynb`를 [Google Colab](https://colab.research.google.com/)에서 열고
(런타임 → T4 GPU 선택) 셀을 순서대로 실행하며 `merged.zip`을 업로드합니다.
학습 → mAP 확인 → 예측 육안 검토 → `best.pt` / `.tflite` 다운로드까지 진행됩니다.

## 학습한 모델을 앱에 연결하는 두 갈래

**빠른 경로 (앱 코드 수정 없음):**
`best.pt`를 Roboflow 프로젝트에 업로드해 hosted 모델로 배포 → 앱 `.env`의
`EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID`를 채우면 바로 실기기 테스트.
단, 클라우드 추론이라 세션당 과금·네트워크 지연은 그대로입니다(검증용).

**온디바이스 경로 (비용 0, 오프라인, 상용화 전제):**
`best_float32.tflite`를 앱에 넣고 `react-native-fast-tflite`로 VisionCamera
프레임 프로세서에서 직접 추론. 자세한 계획은
[../docs/realtime-vision-migration.md](../docs/realtime-vision-migration.md).

## 산출물이 git에 올라가지 않도록

`datasets_raw/`, `merged/`, `*.zip`, `*.pt`, `*.tflite`, `*.onnx`는 용량이 크므로
버전 관리에서 제외하세요. 루트 `.gitignore`에 다음을 추가:

```gitignore
training/datasets_raw/
training/merged/
*.zip
*.pt
*.tflite
*.onnx
```
