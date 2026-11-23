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
    // Mild margin so only nearly tied four_leaf/three_leaf anchors are dropped.
    minClassMargin: 0.05,
  } satisfies YoloDecodeConfig,
  tracker: {
    // 4 frames ≈ 0.7 s at 6/s: tolerates brief flicker while blocking sparse 3-miss false hits.
    requiredStreak: 4,
    // training/eval_threshold.py (YOLOX-Tiny, 2026-10-17): 0.35 → 2.3% false alarms on 300 no-luck photos, 83% of four-leafs found.
    minLockConfidence: 0.35,
    maxMissedFrames: 3,
    iouThreshold: 0.2,
    // Follow new detections closely; TrackBox animates the in-between, so jitter stays low.
    smoothingFactor: 0.7,
    maxTracks: 5,
  } satisfies DetectionTrackerConfig,
  // Rotation rescue angles for post-capture close-up inspection when the upright 0° view misses or is borderline.
  tta: {
    angles: [0, 90, 180] as const,
    minVotes: 2,
    iouThreshold: 0.35,
  },
  // Stage-2 crop classifier (MobileNetV3-Small, 224×224): vetoes clear three-leaf lookalikes (< minProbability)
  // and rescues borderline (0.25–0.35) detector hits when >= rescueProbability.
  verifier: {
    inputSize: 224,
    cropPad: 1.5,
    minProbability: 0.2,
    rescueProbability: 0.42,
  },
  // The live "maybe" hint (? box + status): single-frame hits flickered it on and off over grass while walking,
  // so a candidate shows only once it has held for ~0.5 s with some confidence.
  hint: { minStreak: 3, minConfidence: 0.3 },
} as const;
