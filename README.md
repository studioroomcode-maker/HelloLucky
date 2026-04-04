# Hello Lucky

Hello Lucky is an Expo / React Native prototype for finding four-leaf clovers in a live camera view and drawing detection boxes on top of the preview.

If you are resuming work later, start with [docs/resume-next-session.md](./docs/resume-next-session.md).

## What changed

This app is no longer aimed at single-photo classification only.

The camera screen now runs on VisionCamera preview with a sampled snapshot detector:

1. VisionCamera keeps the preview live
2. a frame processor triggers scan opportunities at a target FPS
3. the app captures lightweight snapshots on the JS side
4. those snapshots are sent to a Roboflow object-detection model
5. a tracker smooths boxes and waits for a stable lock before save is enabled

This is closer to a realtime product feel than the original timer-only prototype, but it is still not a full on-device detector yet.

## What model you need

You do not want a classification model for this goal.

You need an object-detection model trained with bounding boxes around four-leaf clovers.

That means:

- your current `clover_dataset/` image folders are useful as raw source material
- but they are not enough by themselves
- you must annotate four-leaf clovers with boxes before training

## Environment setup

Create a `.env` file from `.env.example`.

Minimum setup:

```env
EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID=four-leaf-detector/3
EXPO_PUBLIC_ROBOFLOW_API_KEY=your_key_here
EXPO_PUBLIC_LIVE_VISION_ENGINE=vision-snapshot
```

Useful tuning values:

```env
EXPO_PUBLIC_LIVE_SCAN_INTERVAL_MS=1100
EXPO_PUBLIC_LIVE_FRAME_PROCESSOR_FPS=6
EXPO_PUBLIC_LIVE_SCAN_REQUIRED_STREAK=2
EXPO_PUBLIC_LIVE_SCAN_MAX_MISSED_FRAMES=1
EXPO_PUBLIC_LIVE_SCAN_IOU_THRESHOLD=0.18
EXPO_PUBLIC_LIVE_SCAN_SMOOTHING=0.55
```

## Run the app

For the current VisionCamera build, use a development client:

```bash
npm install
npm run prebuild
npm run start:dev
```

To check whether the native realtime dependencies are already installed:

```bash
npm run native:status
```

If you change permission strings in `app.json`, rebuild the native app.

## Important technical note

The current build uses VisionCamera preview and frame-processor timing, but the detector still analyzes sampled snapshots sent to Roboflow.

That means:

- the preview can feel much more live
- the detection cadence is still limited by snapshot and network latency
- true on-device realtime detection still needs a native model/plugin path

## Realistic roadmap

To get to the app you described, the order should be:

1. keep improving the detection model in real clover patches
2. collect misses and false positives
3. retrain the model
4. move from snapshot-based detection to an on-device frame-processor model
5. keep the tracker and overlay behavior while swapping the detector implementation

## Native realtime migration

The production path is:

1. keep VisionCamera for preview and frame cadence
2. replace sampled snapshot detection with an on-device detector
3. run detection on a lower target FPS while keeping the preview smooth
4. keep overlay rendering and tracking responsive at preview speed

The exact migration checklist is in [docs/realtime-vision-migration.md](./docs/realtime-vision-migration.md).

## Production warning

This app still sends model requests directly from the client. For production, inference should move behind your own backend or to an on-device model.
