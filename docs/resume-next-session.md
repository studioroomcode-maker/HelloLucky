# Resume Next Session

This file is the handoff note for continuing Hello Lucky later without re-discovering the setup.

## Current app state

The app is no longer an Expo Go app.

It now uses:

1. `react-native-vision-camera`
2. `react-native-worklets-core`
3. an Expo development build
4. a live VisionCamera preview
5. sampled snapshot detection sent to Roboflow
6. a tracker that stabilizes boxes before save is enabled

The camera badge should show `VISION SNAPSHOT` when the current code is running.

## Important limitation

This is not yet a true on-device realtime detector.

The current pipeline is:

1. VisionCamera shows the live preview
2. a frame processor triggers scan opportunities
3. JS captures a snapshot
4. the snapshot is sent to Roboflow
5. returned boxes are smoothed and tracked

That means:

1. it feels more live than the old Expo Camera prototype
2. it still depends on network speed and Roboflow inference latency

## Files that matter most

1. [src/screens/CameraScreen.tsx](/D:/MakingApps/Apps/HelloLucky/src/screens/CameraScreen.tsx)
2. [src/config/liveVision.ts](/D:/MakingApps/Apps/HelloLucky/src/config/liveVision.ts)
3. [src/services/detectionTracker.ts](/D:/MakingApps/Apps/HelloLucky/src/services/detectionTracker.ts)
4. [app.json](/D:/MakingApps/Apps/HelloLucky/app.json)
5. [babel.config.js](/D:/MakingApps/Apps/HelloLucky/babel.config.js)
6. [.env](/D:/MakingApps/Apps/HelloLucky/.env)

## Before running

Make sure `.env` has real Roboflow values.

Required:

```env
EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID=your_model/version
EXPO_PUBLIC_ROBOFLOW_API_KEY=your_key_here
```

If these are empty, the app can launch but detection will fail.

## First-time setup on this machine

Run:

```powershell
npm install
npm run prebuild
```

If native dependencies changed again later, run `npm run prebuild` again.

## First-time install to Android device

1. Enable `Developer options`
2. Enable `USB debugging`
3. Connect the phone by USB
4. Accept the `Allow USB debugging` popup on the phone

Check the device:

```powershell
adb devices
```

Expected:

```text
R3CN30XXXX device
```

If it says `unauthorized`, unlock the phone and accept the popup.

If it shows nothing, the usual causes are:

1. bad USB cable
2. wrong USB mode
3. missing Windows USB driver
4. phone not actually in USB debugging mode

Install the dev build:

```powershell
npm run android:dev
```

## Start the project after the app is installed

Open a terminal in the project and run:

```powershell
$env:CI='1'
npx expo start --dev-client --port 8083 --max-workers 0
```

Notes:

1. `8081` was already occupied during testing, so `8083` is the safer port here
2. `--max-workers 0` was needed because Metro worker spawning hit `spawn EPERM` in the restricted environment
3. `CI=1` avoids the interactive port prompt

Then open the installed `HelloLucky` development app on the phone.

Do not open Expo Go.

## Normal daily restart flow

Use this order:

1. connect the Android phone
2. run `adb devices`
3. run the Metro command above
4. open the installed `HelloLucky` dev app

Usually you do not need to reinstall the app every time.

Reinstall only when:

1. native dependencies changed
2. config plugin settings changed
3. `app.json` native permissions/settings changed
4. the dev build got out of sync

In those cases:

```powershell
npm run prebuild
npm run android:dev
```

## What success looks like

When things are working:

1. the app opens in the custom `HelloLucky` dev build
2. the camera screen loads
3. the top badge says `VISION SNAPSHOT`
4. boxes appear only after the tracker confirms them
5. save stays disabled until a stable lock exists

## Current tuning values

These are in `.env`:

```env
EXPO_PUBLIC_LIVE_VISION_ENGINE=vision-snapshot
EXPO_PUBLIC_LIVE_SCAN_INTERVAL_MS=1100
EXPO_PUBLIC_LIVE_FRAME_PROCESSOR_FPS=6
EXPO_PUBLIC_LIVE_SCAN_REQUIRED_STREAK=2
EXPO_PUBLIC_LIVE_SCAN_MAX_MISSED_FRAMES=1
EXPO_PUBLIC_LIVE_SCAN_IOU_THRESHOLD=0.18
EXPO_PUBLIC_LIVE_SCAN_SMOOTHING=0.55
EXPO_PUBLIC_LIVE_SCAN_MAX_TRACKS=4
```

Useful first adjustments during testing:

1. if boxes almost never appear, lower `EXPO_PUBLIC_ROBOFLOW_DETECTION_MIN_CONFIDENCE`
2. if save never unlocks, set `EXPO_PUBLIC_LIVE_SCAN_REQUIRED_STREAK=1`
3. if boxes jitter too much, raise `EXPO_PUBLIC_LIVE_SCAN_SMOOTHING`

## Known blockers already discovered

1. Expo Go will not work for this app anymore
2. `expo run:android` fails if no phone or emulator is connected
3. detection will fail if the Roboflow env vars are empty

## Best next task after the app launches

Once the app is running on the device, the next highest-value task is:

1. verify boxes appear at all
2. tune confidence and tracker thresholds
3. collect real-world false positives and misses
4. improve the Roboflow detection dataset

After that, the long-term step is replacing snapshot-based remote detection with a true on-device frame-processor detector.
