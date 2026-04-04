import type { DetectionTrackerConfig } from '../services/detectionTracker';

export type LiveVisionEngine = 'vision-snapshot' | 'native-realtime';

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseEngine(value: string | undefined): LiveVisionEngine {
  return value === 'native-realtime' ? 'native-realtime' : 'vision-snapshot';
}

const requestedEngine = parseEngine(process.env.EXPO_PUBLIC_LIVE_VISION_ENGINE);

export const LIVE_VISION = {
  requestedEngine,
  activeEngine: 'vision-snapshot' as const,
  modeLabel: 'VISION SNAPSHOT',
  modeDetail:
    requestedEngine === 'native-realtime'
      ? 'VisionCamera preview is live, but detections still come from sampled snapshots until an on-device model or frame plugin is added.'
      : 'VisionCamera drives the preview and the detector samples snapshots while you scan the patch.',
  scanIntervalMs: Math.max(
    400,
    Math.round(parseNumber(process.env.EXPO_PUBLIC_LIVE_SCAN_INTERVAL_MS, 1100)),
  ),
  frameProcessorFps: Math.max(
    1,
    Math.round(parseNumber(process.env.EXPO_PUBLIC_LIVE_FRAME_PROCESSOR_FPS, 6)),
  ),
  tracker: {
    requiredStreak: Math.max(
      1,
      Math.round(parseNumber(process.env.EXPO_PUBLIC_LIVE_SCAN_REQUIRED_STREAK, 2)),
    ),
    maxMissedFrames: Math.max(
      0,
      Math.round(
        parseNumber(process.env.EXPO_PUBLIC_LIVE_SCAN_MAX_MISSED_FRAMES, 1),
      ),
    ),
    iouThreshold: clamp(
      parseNumber(process.env.EXPO_PUBLIC_LIVE_SCAN_IOU_THRESHOLD, 0.18),
      0.05,
      0.95,
    ),
    smoothingFactor: clamp(
      parseNumber(process.env.EXPO_PUBLIC_LIVE_SCAN_SMOOTHING, 0.55),
      0.05,
      1,
    ),
    maxTracks: Math.max(
      1,
      Math.round(parseNumber(process.env.EXPO_PUBLIC_LIVE_SCAN_MAX_TRACKS, 4)),
    ),
  } satisfies DetectionTrackerConfig,
} as const;
