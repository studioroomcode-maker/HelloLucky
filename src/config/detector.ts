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
    // 0.25 measured best with the 960 model; the tracker's 3-frame streak filters one-off false hits.
    minConfidence: 0.25,
    iouThreshold: 0.45,
    maxBoxes: 5,
    keepClassIndex: 0,
  } satisfies YoloDecodeConfig,
  tracker: {
    // 4 frames ≈ 0.7 s at 6/s: a bit quicker than before, still filters one-off false hits.
    requiredStreak: 4,
    // training/eval_threshold.py (YOLOX-Tiny, 2026-10-17): 0.35 → 2.3% false alarms on 300 no-luck photos, 83% of four-leafs found;
    // the 3-frame streak cuts live false alarms further. Wide-scan candidates use the same bar.
    minLockConfidence: 0.35,
    maxMissedFrames: 3,
    iouThreshold: 0.2,
    // Follow new detections closely; TrackBox animates the in-between, so jitter stays low.
    smoothingFactor: 0.7,
    maxTracks: 5,
  } satisfies DetectionTrackerConfig,
} as const;
