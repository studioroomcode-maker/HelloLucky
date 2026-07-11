# On-Device Detector (활성화 가이드)

스냅샷을 Roboflow로 보내던 원격 감지를, **기기 안에서 직접 추론**하는
온디바이스 경로로 바꾸기 위한 준비물과 활성화 절차입니다.

효과: 추론 비용 0원 · 지연 1초+ → 수십 ms · 오프라인 동작 · API 키 노출 문제 소멸.

## 이미 준비된 것 (이 커밋)

| 항목 | 파일 | 상태 |
|---|---|---|
| YOLOv8 출력 디코딩 + NMS | `src/services/detector/yoloDecode.ts` | ✅ 순수 로직, Node 테스트 통과 |
| 프레임 프로세서 훅 | `src/services/detector/useCloverFrameProcessor.ts` | ✅ 작성 완료(미연결) |
| 모델 설정(.env 파싱) | `src/config/onDeviceModel.ts` | ✅ |
| 네이티브 의존성 | `react-native-fast-tflite`, `react-native-nitro-modules`, `vision-camera-resize-plugin` | ✅ 설치됨 |
| Metro `.tflite` asset | `metro.config.js` | ✅ |
| Expo config 플러그인 | `app.json` (CoreML/Android GPU) | ✅ |
| 모델 자리 | `assets/model/` | ✅ (모델 파일은 없음) |
| env 변수 | `.env`, `.env.example` | ✅ (`EXPO_PUBLIC_ONDEVICE_*`) |

## 아직 안 된 것 / 검증 필요 (정직하게)

이 코드는 **실기기에서 검증되지 않았습니다.** 아래는 활성화하며 반드시
확인해야 하는 부분입니다. 추측이 아니라 "기기에서만 확정되는" 지점들입니다.

1. **모델 파일이 없습니다.** `training/train_yolo.ipynb`로 학습해야 생깁니다.
2. **출력 텐서 형태를 export 후 확인**해야 합니다. `numAnchors`(640→8400)와
   `coordsAreNormalized`(ultralytics는 보통 정규화)가 실제 export와 다르면
   박스가 엉뚱하게 나옵니다. `.env`의 `EXPO_PUBLIC_ONDEVICE_*`로 맞춥니다.
3. **좌표 매핑(크롭 보정).** `resize`는 프레임을 정사각으로 center-crop 합니다.
   디코딩 박스는 입력 정사각(inputSize²) 픽셀 기준이라, 프리뷰가 정사각이 아니면
   오버레이 위치에 오차가 생길 수 있습니다. 기기에서 박스가 살짝 어긋나면
   여기(크롭 오프셋 역보정)를 손봐야 합니다.
4. **CameraScreen은 일부러 건드리지 않았습니다.** 검증 안 된 프레임 프로세서
   코드를 동작하는 메인 화면에 넣어 앱을 깨뜨리지 않기 위함입니다. 연결은 아래 4단계.

## 활성화 절차

### 1. 모델 준비
`training/train_yolo.ipynb`에서 학습 → `best_float32.tflite` 다운로드 →
`assets/model/clover.tflite`로 저장. 상태 확인:

```powershell
npm run native:status
```

### 2. `.env` 설정
```env
EXPO_PUBLIC_LIVE_VISION_ENGINE=native-realtime
# require 번들 대신 파일 URI 로드 시 (예: 앱이 기기 저장소로 복사한 경로)
EXPO_PUBLIC_ONDEVICE_MODEL_URI=file:///data/user/0/com.sungkyun.HelloLucky/files/clover.tflite
EXPO_PUBLIC_ONDEVICE_INPUT_SIZE=640
EXPO_PUBLIC_ONDEVICE_NUM_ANCHORS=8400
EXPO_PUBLIC_ONDEVICE_COORDS_NORMALIZED=true
```

> 번들 동봉(require)을 쓰려면 `assets/model/README.md`의 B안을 참고하세요.

### 3. CameraScreen 연결

`src/screens/CameraScreen.tsx`에 아래를 추가합니다. **스냅샷 경로는 그대로 두고**,
엔진이 native면 온디바이스 프레임 프로세서로 분기하는 최소 변경입니다.

```tsx
// import 추가
import { useCloverFrameProcessor } from '../services/detector/useCloverFrameProcessor';
import { isOnDeviceModelConfigured } from '../config/onDeviceModel';
import type { CloverDetectionBox } from '../services/cloverDetection';

// 컴포넌트 안, 기존 상태 선언 근처
const useOnDevice =
  LIVE_VISION.requestedEngine === 'native-realtime' && isOnDeviceModelConfigured();

// 온디바이스 박스를 기존 트래커로 흘려보내는 핸들러 (스냅샷 경로와 동일한 상태 갱신)
const handleOnDeviceBoxes = useCallback(
  (boxes: CloverDetectionBox[], imageSize: number) => {
    if (!isFocused || !scanEnabled || saving) {
      return;
    }
    const detection: CloverDetectionResult = {
      boxes,
      imageWidth: imageSize,
      imageHeight: imageSize,
      summary: '',
      nextStep: '',
      rawText: '',
    };
    const tracked = advanceDetectionTracker(
      tracker.current,
      detection.boxes,
      LIVE_VISION.tracker,
    );
    tracker.current = tracked.state;
    startTransition(() => {
      setResult(detection);
      setTracking(tracked);
      setStatus(tracked.summary);
    });
  },
  [isFocused, scanEnabled, saving],
);

const onDevice = useCloverFrameProcessor({
  targetFps: LIVE_VISION.frameProcessorFps,
  onBoxes: handleOnDeviceBoxes,
  enabled: useOnDevice && scanEnabled,
});

// <Camera> 의 frameProcessor prop 을 분기
// 기존:  frameProcessor={scanEnabled ? frameProcessor : undefined}
// 변경:  frameProcessor={
//          useOnDevice ? onDevice.frameProcessor
//                      : (scanEnabled ? frameProcessor : undefined)
//        }
```

`modeLabel`/배지도 바꾸고 싶으면 `src/config/liveVision.ts`의
`activeEngine`/`modeLabel`을 native 분기로 확장하세요(선택).

### 4. 네이티브 재빌드
```powershell
npx expo prebuild
npm run android:dev   # 기기 연결 필요
```

## 검증 체크리스트 (기기에서)

1. 배지에 온디바이스 표시가 뜨고, 모델 로드 에러가 없는가 (`modelState`)
2. 클로버(또는 손) 위에 박스가 뜨는가 — **안 뜨면** `NUM_ANCHORS`/`COORDS_NORMALIZED`부터 의심
3. 박스 위치가 대상과 맞는가 — **어긋나면** 크롭 오프셋 역보정 필요(위 3번)
4. 세잎을 네잎으로 얼마나 잡는가 → `EXPO_PUBLIC_ONDEVICE_MIN_CONFIDENCE` 상향
5. 프리뷰가 30fps로 부드러운가 → 추론 `targetFps`를 6~10 사이에서 조정

## 관련 문서
- 학습 파이프라인: [../training/README.md](../training/README.md)
- 장기 마이그레이션 배경: [./realtime-vision-migration.md](./realtime-vision-migration.md)
