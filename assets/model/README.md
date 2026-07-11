# assets/model/

여기에 학습된 온디바이스 감지 모델(`clover.tflite`)을 둡니다.

## 모델을 얻는 법

`training/train_yolo.ipynb`(Colab)에서 학습 후 내보낸
`best_float32.tflite`를 다운로드해 이 폴더에 `clover.tflite`로 저장하세요.

## 앱에 연결하는 법

두 가지 로딩 방식이 있습니다.

### A) 파일 URI 로 로드 (권장 — 모델 없이도 번들이 안 깨짐)

`.env`에 경로를 지정합니다. 앱 첫 실행 시 모델을 기기 저장소로 복사해두고
그 경로를 넘기는 방식이 일반적입니다:

```env
EXPO_PUBLIC_ONDEVICE_MODEL_URI=file:///data/user/0/com.sungkyun.HelloLucky/files/clover.tflite
```

### B) require() 로 번들에 포함

`useCloverFrameProcessor.ts`의 로더를 `loadTensorflowModel({url})` 대신
`useTensorflowModel(require('../../../assets/model/clover.tflite'))`로 바꾸면
모델이 앱에 동봉됩니다. 단 이 경우 파일이 없으면 Metro 번들이 실패하므로,
모델을 확보한 뒤에만 이 방식으로 전환하세요.

`metro.config.js`가 이미 `.tflite`를 asset 확장자로 등록해 두었습니다.

## git 제외

`.tflite`는 용량이 커서 `.gitignore`에 이미 제외되어 있습니다.
이 README 만 버전 관리됩니다.
