/**
 * YOLOv8 tflite 출력 디코딩 + NMS (Non-Max Suppression)
 *
 * 왜 이 파일이 따로 있나:
 *   온디바이스 감지의 가장 까다로운 부분은 모델 실행 자체가 아니라,
 *   모델이 뱉는 원시 텐서를 사람이 이해할 박스로 바꾸는 후처리입니다.
 *   이 로직은 순수 함수라 실기기 없이도 Node 로 검증할 수 있으므로 분리했습니다.
 *   (training/yoloDecode.test 참고)
 *
 * YOLOv8 detection 출력 형태:
 *   [1, 4 + numClasses, numAnchors]   (예: 단일 클래스 → [1, 5, 8400])
 *   행(row) 배치:  [cx, cy, w, h, class0, class1, ...]
 *   Float32Array 로 평탄화되면 인덱스는 row-major:  value(row, anchor) = out[row*numAnchors + anchor]
 *
 * 좌표계:
 *   ultralytics tflite export 는 보통 [0,1] 정규화 cx,cy,w,h 를 냅니다.
 *   픽셀(0..inputSize) 로 나오는 export 도 있어 coordsAreNormalized 로 대응합니다.
 *   이 함수는 항상 inputSize 픽셀 좌표(center 기준)로 통일해 반환합니다.
 *
 * 이 코드는 VisionCamera 프레임 프로세서(worklet) 안에서 호출되므로
 * 클로저 밖 상태나 non-worklet API 를 쓰지 않는 순수 함수로 유지합니다.
 */

export type DecodedBox = {
  /** center x, inputSize 픽셀 좌표 */
  x: number;
  /** center y, inputSize 픽셀 좌표 */
  y: number;
  width: number;
  height: number;
  confidence: number;
  classIndex: number;
};

export type YoloDecodeConfig = {
  /** 앵커 개수 (예: 640 입력 → 8400) */
  numAnchors: number;
  /** 클래스 개수 (단일 클래스 클로버 → 1) */
  numClasses: number;
  /** 정사각 입력 한 변 픽셀 (예: 640) */
  inputSize: number;
  /** 출력 좌표가 [0,1] 정규화면 true, 픽셀이면 false */
  coordsAreNormalized: boolean;
  /** 이 값 미만 신뢰도는 버림 */
  minConfidence: number;
  /** NMS IoU 임계값 (겹침이 이 이상이면 낮은 쪽 제거) */
  iouThreshold: number;
  /** 최종 반환 박스 최대 개수 */
  maxBoxes: number;
  /** 이 클래스 인덱스만 유지 (없으면 전체) */
  keepClassIndex?: number;
};

function iou(a: DecodedBox, b: DecodedBox): number {
  'worklet';
  const aLeft = a.x - a.width / 2;
  const aTop = a.y - a.height / 2;
  const aRight = a.x + a.width / 2;
  const aBottom = a.y + a.height / 2;
  const bLeft = b.x - b.width / 2;
  const bTop = b.y - b.height / 2;
  const bRight = b.x + b.width / 2;
  const bBottom = b.y + b.height / 2;

  const interLeft = Math.max(aLeft, bLeft);
  const interTop = Math.max(aTop, bTop);
  const interRight = Math.min(aRight, bRight);
  const interBottom = Math.min(aBottom, bBottom);

  const interW = Math.max(0, interRight - interLeft);
  const interH = Math.max(0, interBottom - interTop);
  const interArea = interW * interH;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - interArea;

  return union <= 0 ? 0 : interArea / union;
}

/**
 * 원시 YOLOv8 출력(Float32Array) → NMS 를 거친 박스 목록.
 * output 은 tflite.runSync(...) 결과의 첫 텐서를 new Float32Array(outputs[0]) 한 것.
 */
export function decodeYolo(
  output: Float32Array,
  config: YoloDecodeConfig,
): DecodedBox[] {
  'worklet';
  const {
    numAnchors,
    numClasses,
    inputSize,
    coordsAreNormalized,
    minConfidence,
    iouThreshold,
    maxBoxes,
    keepClassIndex,
  } = config;

  const scale = coordsAreNormalized ? inputSize : 1;
  const candidates: DecodedBox[] = [];

  for (let i = 0; i < numAnchors; i++) {
    // 이 앵커에서 가장 높은 클래스 점수를 찾는다.
    let bestScore = 0;
    let bestClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = output[(4 + c) * numAnchors + i];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestScore < minConfidence) {
      continue;
    }
    if (keepClassIndex !== undefined && bestClass !== keepClassIndex) {
      continue;
    }

    const cx = output[0 * numAnchors + i] * scale;
    const cy = output[1 * numAnchors + i] * scale;
    const w = output[2 * numAnchors + i] * scale;
    const h = output[3 * numAnchors + i] * scale;

    if (w <= 0 || h <= 0) {
      continue;
    }

    candidates.push({
      x: cx,
      y: cy,
      width: w,
      height: h,
      confidence: bestScore,
      classIndex: bestClass,
    });
  }

  // 신뢰도 내림차순 정렬 후 그리디 NMS.
  candidates.sort((a, b) => b.confidence - a.confidence);

  const kept: DecodedBox[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    let overlaps = false;
    for (let k = 0; k < kept.length; k++) {
      if (iou(candidate, kept[k]) > iouThreshold) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      kept.push(candidate);
      if (kept.length >= maxBoxes) {
        break;
      }
    }
  }

  return kept;
}
