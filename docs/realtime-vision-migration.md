# Native Realtime Migration

This document is the implementation target for moving Hello Lucky from snapshot-based remote detection to a true on-device realtime detector.

## Current state

The repository now uses:

1. VisionCamera for preview
2. a frame processor to trigger scan opportunities
3. sampled snapshots for the current detector input
4. a JS-side tracker to smooth and stabilize boxes

That means the app already feels more live than the old timer-only build, but detection is still limited by snapshot capture plus remote inference latency.

## Goal

The real goal is not "run the detector at 30fps on every device".

The real goal is:

1. keep the camera preview smooth at 30fps
2. run detection at a lower but steady target fps
3. draw stable boxes that feel realtime to the user

That is the practical path for a small-object use case like four-leaf clovers.

## Stack

Use this stack:

1. `react-native-vision-camera`
2. `react-native-worklets-core`
3. Expo development build, not Expo Go
4. on-device model inference
5. overlay smoothing and tracking in shared state

## Build steps

Check the repository state:

```bash
npm run native:status
```

Build the native client when dependencies are installed:

```bash
npx expo prebuild
npm run start:dev
```

## Camera pipeline

The long-term camera screen should be split into these responsibilities:

1. preview surface
2. frame processor
3. detector bridge
4. tracker
5. overlay renderer
6. high-resolution save capture

The tracker already exists in the current build. Reuse that logic when you swap the detector implementation so user-facing behavior stays stable.

## Performance target

Start with this target:

1. preview: 30fps
2. detection: 6 to 12fps
3. stable overlay: 30fps-feeling UI through smoothing and persistence

Do not try to force 30fps full-resolution detection first. That is the wrong optimization target for this problem.

## Model guidance

The model should be:

1. single-class detection
2. trained on dense clover-field images, not just close-up leaves
3. biased toward low false positives
4. exported in an on-device format that your native inference path can load

## Next code changes for true on-device realtime

When you are ready to replace the remote snapshot detector, the next code changes should be:

1. add or integrate a native frame-processor plugin for the model
2. move inference off the JS snapshot path and into the frame processor pipeline
3. keep the current detection tracker and overlay semantics
4. retune confidence thresholds and tracking windows for the on-device model

## Current limitation

The app is already on VisionCamera, but it is not yet running a true on-device object detector.
