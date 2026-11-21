import type { DetectionTrackerConfig } from '../services/detectionTracker';
import type { YoloDecodeConfig } from '../services/detector/yoloDecode';

/** Must match input_size in training/yolox_exp.py. */
const INPUT_SIZE = 960;

export const DETECTOR = {
  inputSize: INPUT_SIZE,
  /** Inference rate; YOLOX-Tiny takes ~56 ms per run at 960 on a Galaxy S25, but 8/s heated it to ~96 ms. */
  targetFps: 6,
  decode: {
    // Grid cells for a square input at strides 8/16/32: (s/8)^2 + (s/16)^2 + (s/32)^2
    numAnchors: (INPUT_SIZE / 8) ** 2 + (INPUT_SIZE / 16) ** 2 + (INPUT_SIZE / 32) ** 2,
    // YOLOX (training/export_yolox.py): 0 four_leaf, 1 three_leaf; only four_leaf boxes are kept.
    numClasses: 2,
    inputSize: INPUT_SIZE,
    coordsAreNormalized: true,
    // 0.25 measured best with the 960 model; the tracker's sliding window filters one-off false hits.
    minConfidence: 0.25,
    iouThreshold: 0.45,
    maxBoxes: 5,
    keepClassIndex: 0,
    // Require four_leaf to beat three_leaf by at least this margin so ambiguous borderline clovers are dropped.
    minClassMargin: 0.1,
  } satisfies YoloDecodeConfig,
  tracker: {
    // 4 hits within the last 6 frames (~1 s at 6/s): tolerates brief flicker without letting intermittent false hits accumulate.
    requiredStreak: 4,
    confirmWindow: 6,
    // training/eval_threshold.py (YOLOX-Tiny, 2026-10-17): 0.35 → 2.3% false alarms on 300 no-luck photos, 83% of four-leafs found;
    // the sliding window cuts live false alarms further. Wide-scan candidates use the same bar.
    minLockConfidence: 0.35,
    maxMissedFrames: 3,
    iouThreshold: 0.2,
    // Follow new detections closely; TrackBox animates the in-between, so jitter stays low.
    smoothingFactor: 0.7,
    maxTracks: 5,
  } satisfies DetectionTrackerConfig,
  // Hold live lock confirmation when the scene is panning faster than this multiple of view width per second (motion blur).
  maxLockPanRate: 0.8,
  // Rotation TTA for post-capture / wide-scan close-up verification: 2 of 3 views must agree.
  tta: {
    angles: [0, 90, 180] as const,
    minVotes: 2,
    iouThreshold: 0.35,
  },
  // Stage-2 crop classifier (MobileNetV3-Small, 224×224): rejects overlapping three-leaf lookalikes (~5–10 ms).
  verifier: {
    inputSize: 224,
    cropPad: 1.5,
    // training/train_verifier.py (bal_acc 94.1%): 0.45 keeps ~92.5% of real four-leafs while rejecting
    // ~96% of three-leafs and ~79% of YOLOX's hardest holdout false positives.
    minProbability: 0.45,
  },
  // The live "maybe" hint (? box + status): single-frame hits flickered it on and off over grass while walking,
  // so a candidate shows only once it has held for ~0.5 s with some confidence.
  hint: { minStreak: 3, minConfidence: 0.3 },
} as const;
