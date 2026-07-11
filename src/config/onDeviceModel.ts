/**
 * 온디바이스 YOLOv8 클로버 감지 모델 설정
 *
 * training/train_yolo.ipynb 에서 내보낸 .tflite 모델의 입력/출력 사양과
 * 후처리 임계값을 .env 에서 읽어옵니다. 값들은 export 한 모델에 맞춰
 * 조정해야 하며, 특히 numAnchors / coordsAreNormalized 는 모델마다 다릅니다.
 *
 * 관련: src/services/detector/yoloDecode.ts, src/services/detector/useCloverFrameProcessor.ts
 */

import type { YoloDecodeConfig } from '../services/detector/yoloDecode';

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value.trim().toLowerCase() === 'true';
}

/** 정사각 입력 한 변 (yolo export imgsz 와 일치해야 함). */
const INPUT_SIZE = Math.max(
  32,
  Math.round(parseNumber(process.env.EXPO_PUBLIC_ONDEVICE_INPUT_SIZE, 640)),
);

/**
 * 앵커 개수. YOLOv8 는 imgsz 에 따라 정해집니다:
 *   640 → 8400, 320 → 2100, 1280 → 33600  (= (s/8)^2 + (s/16)^2 + (s/32)^2)
 * 기본값은 640 기준 8400. 다른 imgsz 면 .env 로 덮어쓰세요.
 */
const NUM_ANCHORS = Math.max(
  1,
  Math.round(parseNumber(process.env.EXPO_PUBLIC_ONDEVICE_NUM_ANCHORS, 8400)),
);

export const ON_DEVICE_MODEL = {
  /**
   * 번들 require 대신 파일 URI 로 로드하는 경로.
   * 비어 있으면 온디바이스 엔진은 비활성(스냅샷 엔진으로 유지)입니다.
   * 예: `${FileSystem.documentDirectory}clover.tflite` 또는 앱에 동봉한 asset 경로.
   */
  modelUri: process.env.EXPO_PUBLIC_ONDEVICE_MODEL_URI ?? '',

  /** iOS CoreML / Android GPU 델리게이트 사용 시도 여부. */
  useGpuDelegate: parseBool(process.env.EXPO_PUBLIC_ONDEVICE_GPU, true),

  inputSize: INPUT_SIZE,

  decode: {
    numAnchors: NUM_ANCHORS,
    numClasses: Math.max(
      1,
      Math.round(parseNumber(process.env.EXPO_PUBLIC_ONDEVICE_NUM_CLASSES, 1)),
    ),
    inputSize: INPUT_SIZE,
    coordsAreNormalized: parseBool(
      process.env.EXPO_PUBLIC_ONDEVICE_COORDS_NORMALIZED,
      true,
    ),
    minConfidence: parseNumber(
      process.env.EXPO_PUBLIC_ONDEVICE_MIN_CONFIDENCE,
      0.4,
    ),
    iouThreshold: parseNumber(process.env.EXPO_PUBLIC_ONDEVICE_IOU, 0.45),
    maxBoxes: Math.max(
      1,
      Math.round(parseNumber(process.env.EXPO_PUBLIC_ROBOFLOW_MAX_BOXES, 4)),
    ),
    keepClassIndex: 0, // 단일 클래스 'four_leaf' → 인덱스 0
  } satisfies YoloDecodeConfig,
} as const;

export function isOnDeviceModelConfigured() {
  return ON_DEVICE_MODEL.modelUri.trim().length > 0;
}
