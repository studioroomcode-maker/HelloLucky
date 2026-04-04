export type CloverDetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  rawLabel: string;
};

export type CloverDetectionResult = {
  boxes: CloverDetectionBox[];
  imageWidth: number;
  imageHeight: number;
  summary: string;
  nextStep: string;
  rawText: string;
};

type RoboflowPrediction = {
  class?: string;
  confidence?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

const ROBOFLOW_BASE_URL =
  process.env.EXPO_PUBLIC_ROBOFLOW_DETECTION_BASE_URL ??
  'https://detect.roboflow.com';
const ROBOFLOW_MODEL_ID =
  process.env.EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID ??
  process.env.EXPO_PUBLIC_ROBOFLOW_MODEL_ID ??
  '';
const ROBOFLOW_API_KEY = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY ?? '';
const MIN_CONFIDENCE = parseNumber(
  process.env.EXPO_PUBLIC_ROBOFLOW_DETECTION_MIN_CONFIDENCE,
  0.55,
);
const MAX_BOXES = Math.max(
  1,
  Math.round(parseNumber(process.env.EXPO_PUBLIC_ROBOFLOW_MAX_BOXES, 4)),
);
const TARGET_LABELS = parseAliases(process.env.EXPO_PUBLIC_ROBOFLOW_TARGET_LABELS, [
  'four_leaf',
  'four leaf',
  'four-leaf',
  '4leaf',
  '4-leaf',
]);

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAliases(value: string | undefined, defaults: string[]) {
  const source = value?.trim() ? value.split(',') : defaults;

  return source
    .map((item) => normalizeAlias(item))
    .filter(Boolean);
}

function normalizeAlias(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isTargetLabel(value: string) {
  const normalized = normalizeAlias(value);

  return (
    TARGET_LABELS.includes(normalized) ||
    normalized.includes('fourleaf') ||
    normalized.includes('4leaf')
  );
}

function fallbackSummary(count: number) {
  if (count === 0) {
    return 'No four-leaf clover detected in this frame.';
  }

  if (count === 1) {
    return 'Detected 1 likely four-leaf clover.';
  }

  return `Detected ${count} likely four-leaf clovers.`;
}

function fallbackNextStep(count: number) {
  if (count === 0) {
    return 'Move closer, hold steady, and scan the patch again.';
  }

  return 'Hold steady and save while the detection box stays stable.';
}

async function parseError(response: Response) {
  try {
    const payload = await response.json();
    const message = payload?.error?.message ?? payload?.message;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // Fall back to plain text below.
  }

  try {
    const text = await response.text();
    return text.trim() || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function parsePredictions(payload: any): CloverDetectionBox[] {
  if (!Array.isArray(payload?.predictions)) {
    return [];
  }

  return payload.predictions
    .map((prediction: RoboflowPrediction) => ({
      rawLabel: typeof prediction.class === 'string' ? prediction.class : '',
      confidence:
        typeof prediction.confidence === 'number' ? prediction.confidence : 0,
      x: typeof prediction.x === 'number' ? prediction.x : 0,
      y: typeof prediction.y === 'number' ? prediction.y : 0,
      width: typeof prediction.width === 'number' ? prediction.width : 0,
      height: typeof prediction.height === 'number' ? prediction.height : 0,
    }))
    .filter((prediction: CloverDetectionBox) => {
      return (
        prediction.rawLabel &&
        isTargetLabel(prediction.rawLabel) &&
        prediction.confidence >= MIN_CONFIDENCE &&
        prediction.width > 0 &&
        prediction.height > 0
      );
    })
    .sort(
      (left: CloverDetectionBox, right: CloverDetectionBox) =>
        right.confidence - left.confidence,
    )
    .slice(0, MAX_BOXES);
}

export async function detectFourLeafCloverBoxes(
  base64Image: string,
): Promise<CloverDetectionResult> {
  if (!base64Image) {
    throw new Error('The captured image data is empty.');
  }

  if (!ROBOFLOW_MODEL_ID || !ROBOFLOW_API_KEY) {
    throw new Error(
      'Set EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID and EXPO_PUBLIC_ROBOFLOW_API_KEY in .env.',
    );
  }

  const endpoint =
    `${ROBOFLOW_BASE_URL.replace(/\/$/, '')}/${ROBOFLOW_MODEL_ID}` +
    `?api_key=${encodeURIComponent(ROBOFLOW_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: base64Image,
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(`Roboflow detection request failed: ${message}`);
  }

  const payload = await response.json();
  const boxes = parsePredictions(payload);
  const imageWidth =
    typeof payload?.image?.width === 'number' ? payload.image.width : 0;
  const imageHeight =
    typeof payload?.image?.height === 'number' ? payload.image.height : 0;
  const rawText = JSON.stringify(payload);

  return {
    boxes,
    imageWidth,
    imageHeight,
    summary: fallbackSummary(boxes.length),
    nextStep: fallbackNextStep(boxes.length),
    rawText,
  };
}
