import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  GestureResponderEvent,
  LayoutChangeEvent,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { Gyroscope } from 'expo-sensors';
import { useSharedValue } from 'react-native-reanimated';

import { CameraColors, FONT } from '@/constants/theme';
import { DETECTOR } from '@/src/config/detector';
import { t } from '@/src/i18n';
import {
  advanceDetectionTracker,
  createDetectionTrackerState,
  createEmptyDetectionTrackerSnapshot,
  type DetectionTrackerSnapshot,
} from '@/src/services/detectionTracker';
import { focalLength, integrate, motionAt, type MotionSample } from '@/src/services/detector/cameraMotion';
import { projectToView } from '@/src/services/detector/frameMapping';
import { useCloverFrameProcessor, type FrameDetections } from '@/src/services/detector/useCloverFrameProcessor';
import { saveCapture } from '@/src/services/capture';
import { PrimaryButton } from '@/src/ui/PrimaryButton';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { TrackBox } from '@/src/ui/TrackBox';

// The OS takes the camera away when the app is hidden or another app grabs it; just reopen it.
const TRANSIENT_CAMERA_ERRORS = new Set([
  'system/camera-is-restricted',
  'device/camera-already-in-use',
  'system/max-cameras-in-use',
]);

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export default function Scan() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // The user tapped "find", so asking right away is the expected next step.
    if (!hasPermission) requestPermission().then((granted) => setBlocked(!granted));
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <PermissionGate
        blocked={blocked}
        onPress={async () => {
          if (blocked) {
            Linking.openSettings();
          } else {
            setBlocked(!(await requestPermission()));
          }
        }}
      />
    );
  }
  return <Scanner />;
}

function PermissionGate({ blocked, onPress }: { blocked: boolean; onPress: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.gate, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <CloseButton onPress={() => router.back()} />
      <View style={styles.gateBody}>
        <Ionicons name="camera-outline" size={64} color="#fff" />
        <Text style={styles.gateTitle}>{t.cameraPermissionTitle}</Text>
        <Text style={styles.gateText}>{t.cameraPermissionBody}</Text>
      </View>
      <PrimaryButton label={blocked ? t.openSettings : t.cameraPermissionButton} onPress={onPress} />
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.close} style={styles.roundBtn}>
      <Ionicons name="close" size={26} color="#fff" />
    </Pressable>
  );
}

function Scanner() {
  // Sweeping a clover patch takes minutes without touching the screen; don't let it dim or lock.
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const appActive = useAppActive();
  const device = useCameraDevice('back');
  // Preview, frames and photos all use the sensor's 4:3. On Android a 16:9 analysis size made a Galaxy S25 squeeze
  // the 4:3 view (clovers 25% thinner, boxes off), so frames follow the photo's aspect (patches/react-native-vision-camera)
  // at 1920×1440; iOS has native 4:3 video formats. Video recording stays off, so the preview follows the photo too.
  const format = useCameraFormat(device, [
    { photoAspectRatio: 4 / 3 },
    { photoResolution: { width: 4032, height: 3024 } },
    { videoAspectRatio: 4 / 3 },
    { videoResolution: { width: 1920, height: 1440 } },
  ]);
  const camera = useRef<Camera>(null);
  const tracker = useRef(createDetectionTrackerState());
  const wasLocked = useRef(false);
  const [burst, setBurst] = useState(0);

  const [torch, setTorch] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [tracking, setTracking] = useState<DetectionTrackerSnapshot>(createEmptyDetectionTrackerSnapshot);

  // Gyro follow: boxes ride along with the scene between detector frames (see cameraMotion.ts).
  const motion = useSharedValue({ x: 0, y: 0 });
  const history = useRef<MotionSample[]>([{ t: Date.now(), x: 0, y: 0 }]);
  const focal = useRef(0);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  const onDetections = useCallback((result: FrameDetections) => {
    const next = advanceDetectionTracker(tracker.current, result.boxes, DETECTOR.tracker);
    tracker.current = next.state;
    const locked = next.stableTracks.length > 0;
    if (locked && !wasLocked.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setBurst((n) => n + 1);
    }
    wasLocked.current = locked;
    setFrame({ width: result.imageWidth, height: result.imageHeight });
    // The boxes describe a frame captured ~100 ms ago (inference + pipeline); pin them to the motion at that moment.
    setAnchor(motionAt(history.current, Date.now() - 100));
    setTracking(next);
  }, []);

  const { frameProcessor, modelState } = useCloverFrameProcessor(onDetections);

  const zoomPresets = useMemo(() => {
    if (!device) return [];
    const base = Math.max(1, device.neutralZoom);
    return [1, 2, 3]
      .map((factor) => Math.min(base * factor, device.maxZoom))
      .filter((value, index, all) => all.indexOf(value) === index)
      .map((value, index) => ({ label: `${index + 1}x`, value }));
  }, [device]);

  useEffect(() => {
    if (device) setZoom(Math.max(1, device.neutralZoom));
  }, [device]);

  focal.current = focalLength(view.height, format?.fieldOfView ?? 70, zoom / Math.max(1, device?.neutralZoom ?? 1));
  useEffect(() => {
    if (!isFocused || !appActive) return;
    Gyroscope.setUpdateInterval(16);
    const sub = Gyroscope.addListener((rate) => {
      const prev = history.current[history.current.length - 1];
      const next = integrate(prev, rate, Date.now(), focal.current);
      history.current.push(next);
      if (history.current.length > 90) history.current.shift();
      motion.value = { x: next.x, y: next.y };
    });
    return () => sub.remove();
  }, [isFocused, appActive, motion]);

  const locked = tracking.stableTracks.length > 0;
  const status =
    modelState === 'loading'
      ? t.scanLoadingModel
      : modelState === 'error'
        ? t.scanModelError
        : locked
          ? t.scanLocked
          : tracking.candidateTracks.length > 0
            ? t.scanCandidate
            : t.scanIdle;

  const overlay = frame.width && view.width
    ? tracking.tracks.map((track) => ({
        track,
        rect: (({ left, top, width, height }) => ({ left: left - anchor.x, top: top - anchor.y, width, height }))(
          projectToView(track, frame.width, frame.height, view.width, view.height),
        ),
      }))
    : [];

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setView({ width, height });
  };

  const onTapToFocus = (event: GestureResponderEvent) => {
    if (!device?.supportsFocus) return;
    camera.current?.focus({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }).catch(() => {});
  };

  // Wide scan: one full-resolution photo, analyzed tile by tile on the next screen.
  const wideCapture = async () => {
    if (!camera.current || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const photo = await camera.current.takePhoto({ flash: 'off', enableShutterSound: false });
      router.push({ pathname: '/wide', params: { path: photo.path } });
    } catch (error) {
      console.warn('scan: wide capture failed', error);
      Alert.alert(t.cameraError);
    } finally {
      setSaving(false);
    }
  };

  const capture = async () => {
    if (!camera.current || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // The torch already lights the scene; a capture flash would fight it.
      const photo = await camera.current.takePhoto({ flash: 'off', enableShutterSound: false });
      const id = await saveCapture(photo.path, locked);
      router.replace({ pathname: '/find/[id]', params: { id, fresh: '1' } });
    } catch (error) {
      console.warn('scan: capture failed', error);
      Alert.alert(t.saveError);
      setSaving(false);
    }
  };

  if (!device) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top }]}>
        <CloseButton onPress={() => router.back()} />
        <View style={styles.gateBody}>
          <Text style={styles.gateTitle}>{t.noCamera}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Camera
        key={cameraKey}
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={isFocused && appActive}
        photo
        video={false}
        zoom={zoom}
        torch={torch && device.hasTorch ? 'on' : 'off'}
        resizeMode="cover"
        // Photos follow the portrait preview, not how the phone happens to be tilted (flat over a patch).
        outputOrientation="preview"
        androidPreviewViewType="texture-view"
        photoQualityBalance="balanced"
        frameProcessor={frameProcessor}
        onError={(error) => {
          console.warn('scan: camera error', error);
          if (TRANSIENT_CAMERA_ERRORS.has(error.code)) {
            setTimeout(() => setCameraKey((k) => k + 1), 1000);
            return;
          }
          Alert.alert(t.cameraError, error.message);
        }}
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={onTapToFocus} accessible={false} />
      <LuckBurst trigger={burst} />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {overlay.map(({ track, rect }) => (
          <TrackBox key={track.id} rect={rect} motion={motion} stable={track.isStable} label={track.isStable ? `${Math.round(track.confidence * 100)}%` : '?'} />
        ))}
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <CloseButton onPress={() => router.back()} />
        <View style={[styles.status, locked && styles.statusLocked]} accessibilityLiveRegion="polite">
          {modelState === 'loading' ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={[styles.statusText, locked && styles.statusTextLocked]}>{status}</Text>
        </View>
        <Pressable
          onPress={() => setTorch((value) => !value)}
          disabled={!device.hasTorch}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={torch ? t.torchOff : t.torchOn}
          style={[styles.roundBtn, !device.hasTorch && styles.disabled, torch && styles.roundBtnActive]}
        >
          <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color={torch ? '#10210F' : '#fff'} />
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <Text style={styles.tip}>{t.scanTip}</Text>
        {zoomPresets.length > 1 ? (
          <View style={styles.zoomRow}>
            {zoomPresets.map((preset) => {
              const selected = Math.abs(zoom - preset.value) < 0.05;
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => setZoom(preset.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.zoomChip, selected && styles.zoomChipSelected]}
                >
                  <Text style={[styles.zoomText, selected && styles.zoomTextSelected]}>{preset.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={styles.shutterRow}>
          <View style={styles.side} />
          <Pressable
            onPress={capture}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t.shutter}
            style={({ pressed }) => [styles.shutter, locked && styles.shutterLocked, pressed && styles.shutterPressed]}
          >
            {saving ? (
              <ActivityIndicator color="#10210F" />
            ) : (
              <View style={[styles.shutterInner, locked && styles.shutterInnerLocked]} />
            )}
          </Pressable>
          <Pressable
            onPress={wideCapture}
            disabled={saving || modelState !== 'ready'}
            accessibilityRole="button"
            accessibilityLabel={t.wideButton}
            style={({ pressed }) => [styles.side, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.wideIcon}>
              <Ionicons name="grid-outline" size={24} color="#fff" />
            </View>
            <Text style={styles.wideText} numberOfLines={2}>
              {t.wideButton}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gate: { flex: 1, backgroundColor: '#0D130F', paddingHorizontal: 24 },
  gateBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  gateTitle: { color: '#fff', fontSize: 22, fontFamily: FONT.cute, textAlign: 'center' },
  gateText: { fontFamily: FONT.body, color: 'rgba(255,255,255,0.8)', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CameraColors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnActive: { backgroundColor: CameraColors.lock },
  disabled: { opacity: 0.4 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 10,
  },
  status: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: CameraColors.scrim,
  },
  statusLocked: { backgroundColor: CameraColors.lock },
  statusText: { color: '#fff', fontSize: 15, fontFamily: FONT.cute, textAlign: 'center', flexShrink: 1 },
  statusTextLocked: { color: '#10210F' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 16 },
  tip: {
    fontFamily: FONT.body,
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  zoomRow: { flexDirection: 'row', gap: 8, backgroundColor: CameraColors.scrim, borderRadius: 22, padding: 4 },
  zoomChip: { minWidth: 44, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  zoomChipSelected: { backgroundColor: 'rgba(255,255,255,0.9)' },
  zoomText: { color: '#fff', fontSize: 14, fontFamily: FONT.cute },
  zoomTextSelected: { color: '#10210F' },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterLocked: { borderColor: CameraColors.lock },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  side: { width: 76, alignItems: 'center', gap: 4 },
  wideIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: CameraColors.scrim, alignItems: 'center', justifyContent: 'center' },
  wideText: {
    fontFamily: FONT.medium,
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  shutterInnerLocked: { backgroundColor: CameraColors.lock },
});
