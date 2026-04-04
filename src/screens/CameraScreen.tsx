import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type CameraDevice,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';

import { LIVE_VISION } from '../config/liveVision';
import type { AppNavigation } from '../navigation/routerNavigation';
import {
  advanceDetectionTracker,
  createDetectionTrackerState,
  createEmptyDetectionTrackerSnapshot,
  type DetectionTrack,
  type DetectionTrackerSnapshot,
} from '../services/detectionTracker';
import { detectFourLeafCloverBoxes, type CloverDetectionResult } from '../services/cloverDetection';
import { saveCloverSpot } from '../services/supabase';

const DEFAULT_STATUS =
  'VisionCamera preview is live. Hold steady while sampled frames are analyzed.';

type Props = {
  navigation: AppNavigation;
};

type ViewportSize = {
  width: number;
  height: number;
};

type OverlayBox = DetectionTrack & {
  left: number;
  top: number;
  overlayWidth: number;
  overlayHeight: number;
};

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

function formatTrackLabel(box: DetectionTrack) {
  if (box.isStable) {
    return `LOCK ${formatConfidence(box.confidence)}`;
  }

  const progress = Math.min(box.streak, LIVE_VISION.tracker.requiredStreak);
  return `TRACK ${progress}/${LIVE_VISION.tracker.requiredStreak}`;
}

function projectBox(
  box: DetectionTrack,
  imageWidth: number,
  imageHeight: number,
  viewport: ViewportSize,
): OverlayBox | null {
  if (!imageWidth || !imageHeight || !viewport.width || !viewport.height) {
    return null;
  }

  const scale = Math.max(
    viewport.width / imageWidth,
    viewport.height / imageHeight,
  );
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;
  const offsetX = (viewport.width - scaledWidth) / 2;
  const offsetY = (viewport.height - scaledHeight) / 2;
  const left = offsetX + (box.x - box.width / 2) * scale;
  const top = offsetY + (box.y - box.height / 2) * scale;

  return {
    ...box,
    left,
    top,
    overlayWidth: box.width * scale,
    overlayHeight: box.height * scale,
  };
}

function ensureFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function clampZoom(value: number, device: CameraDevice) {
  return Math.min(Math.max(value, device.minZoom), device.maxZoom);
}

function buildZoomPresets(device: CameraDevice) {
  const rawValues = [
    Math.max(1, device.neutralZoom),
    clampZoom(2, device),
    clampZoom(3, device),
  ];

  return rawValues
    .filter(
      (value, index, values) =>
        values.findIndex((candidate) => Math.abs(candidate - value) < 0.05) ===
        index,
    )
    .map((value) => ({
      label: `${Number(value.toFixed(1))}x`,
      value,
    }));
}

function isFatalScanError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('expo_public_') ||
    normalized.includes('permission') ||
    normalized.includes('camera device') ||
    normalized.includes('snapshot') ||
    normalized.includes('frame processor')
  );
}

export default function CameraScreen({ navigation }: Props) {
  const camera = useRef<Camera>(null);
  const tracker = useRef(createDetectionTrackerState());
  const scanBusy = useRef(false);
  const lastScanAt = useRef(0);
  const isFocused = useIsFocused();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [zoom, setZoom] = useState(1);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [result, setResult] = useState<CloverDetectionResult | null>(null);
  const [tracking, setTracking] = useState<DetectionTrackerSnapshot>(() =>
    createEmptyDetectionTrackerSnapshot(),
  );

  const zoomPresets = useMemo(() => {
    if (!device) {
      return [];
    }

    return buildZoomPresets(device);
  }, [device]);

  const resetTracking = useCallback(() => {
    tracker.current = createDetectionTrackerState();
    lastScanAt.current = 0;
    setTracking(createEmptyDetectionTrackerSnapshot());
    setResult(null);
  }, []);

  useEffect(() => {
    if (!device) {
      return;
    }

    setZoom(clampZoom(Math.max(1, device.neutralZoom), device));
  }, [device]);

  useEffect(() => {
    if (!isFocused) {
      setCameraReady(false);
      setAnalyzing(false);
      resetTracking();
    }
  }, [isFocused, resetTracking]);

  const resultToneStyle = useMemo(() => {
    if (tracking.stableTracks.length > 0) {
      return styles.topBadgeSuccess;
    }

    if (tracking.candidateTracks.length > 0) {
      return styles.topBadgeWarn;
    }

    return scanEnabled ? styles.topBadgeNeutral : styles.topBadgeWarn;
  }, [scanEnabled, tracking]);

  const overlayBoxes = useMemo(() => {
    if (!result) {
      return [];
    }

    return tracking.tracks
      .map((box) =>
        projectBox(box, result.imageWidth, result.imageHeight, viewport),
      )
      .filter((box): box is OverlayBox => box !== null);
  }, [result, tracking, viewport]);

  const onViewportLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  const runVisionAnalysis = useCallback(
    async (_frameTimestamp: number) => {
      if (
        !camera.current ||
        !cameraReady ||
        !isFocused ||
        !scanEnabled ||
        saving ||
        scanBusy.current
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastScanAt.current < LIVE_VISION.scanIntervalMs) {
        return;
      }

      lastScanAt.current = now;
      scanBusy.current = true;
      setAnalyzing(true);

      try {
        const snapshot = await camera.current.takeSnapshot({ quality: 70 });
        const snapshotUri = ensureFileUri(snapshot.path);
        const base64 = await FileSystem.readAsStringAsync(snapshotUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64) {
          throw new Error('Snapshot capture returned empty image data.');
        }

        const detection = await detectFourLeafCloverBoxes(base64);
        const normalizedDetection: CloverDetectionResult = {
          ...detection,
          imageWidth: detection.imageWidth || snapshot.width,
          imageHeight: detection.imageHeight || snapshot.height,
        };
        const tracked = advanceDetectionTracker(
          tracker.current,
          normalizedDetection.boxes,
          LIVE_VISION.tracker,
        );

        tracker.current = tracked.state;
        startTransition(() => {
          setResult(normalizedDetection);
          setTracking(tracked);
          setStatus(tracked.summary);
        });
      } catch (error: any) {
        const message = error?.message || 'Live scan failed.';

        if (isFatalScanError(message)) {
          resetTracking();
          setScanEnabled(false);
          setStatus(message);
          Alert.alert('Scan stopped', message);
        } else {
          setStatus('Detector request failed. The preview is still live and the scanner will retry.');
        }
      } finally {
        scanBusy.current = false;
        setAnalyzing(false);
      }
    },
    [cameraReady, isFocused, resetTracking, saving, scanEnabled],
  );

  const requestAnalysisOnJS = useRunOnJS(runVisionAnalysis, [runVisionAnalysis]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(LIVE_VISION.frameProcessorFps, () => {
        'worklet';
        requestAnalysisOnJS(frame.timestamp);
      });
    },
    [requestAnalysisOnJS],
  );

  const handleSave = async () => {
    if (!camera.current || !tracking.stableTracks.length) {
      return;
    }

    setSaving(true);

    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();

      if (locStatus !== 'granted') {
        throw new Error('Location permission is required to save this find.');
      }

      setStatus('Capturing a full-resolution save frame...');
      const photo = await camera.current.takePhoto({
        enableShutterSound: false,
        flash: torchEnabled && device?.hasFlash ? 'on' : 'off',
      });
      const photoUri = ensureFileUri(photo.path);
      const location = await Location.getCurrentPositionAsync({});

      await saveCloverSpot({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        imageUri: photoUri,
      });

      Alert.alert('Saved', 'The detected four-leaf clover was saved to the map.', [
        {
          text: 'View map',
          onPress: () => navigation.replace('map'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Save error', error?.message || 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleScan = () => {
    setScanEnabled((value) => {
      const next = !value;
      resetTracking();
      if (!next) {
        setStatus('Live scan paused.');
      } else {
        setStatus('VisionCamera is sampling live frames for four-leaf clovers...');
      }
      return next;
    });
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera permission is required to scan clovers.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={[styles.permissionText, styles.deviceLoadingText]}>
          Waiting for the back camera...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={onViewportLayout}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        photo
        video
        torch={torchEnabled && device.hasTorch ? 'on' : 'off'}
        zoom={zoom}
        resizeMode="cover"
        androidPreviewViewType="texture-view"
        photoQualityBalance="balanced"
        onInitialized={() => {
          setCameraReady(true);
          setStatus('VisionCamera is sampling live frames for four-leaf clovers...');
        }}
        onError={(error) => {
          setScanEnabled(false);
          setStatus(error.message);
          Alert.alert('Camera error', error.message);
        }}
        frameProcessor={scanEnabled ? frameProcessor : undefined}
      />

      <View pointerEvents="none" style={styles.boxLayer}>
        {overlayBoxes.map((box) => (
          <View
            key={box.id}
            style={[
              styles.detectionBox,
              box.isStable ? styles.detectionBoxStable : styles.detectionBoxCandidate,
              {
                left: box.left,
                top: box.top,
                width: box.overlayWidth,
                height: box.overlayHeight,
              },
            ]}
          >
            <View
              style={[
                styles.detectionLabel,
                box.isStable
                  ? styles.detectionLabelStable
                  : styles.detectionLabelCandidate,
              ]}
            >
              <Text
                style={[
                  styles.detectionLabelText,
                  box.isStable
                    ? styles.detectionLabelTextStable
                    : styles.detectionLabelTextCandidate,
                ]}
              >
                {formatTrackLabel(box)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBadge, resultToneStyle]}>
          <View style={styles.topBadgeHeader}>
            <Text style={styles.topBadgeTitle}>LIVE FOUR-LEAF SCAN</Text>
            <View style={styles.engineChip}>
              <Text style={styles.engineChipText}>{LIVE_VISION.modeLabel}</Text>
            </View>
          </View>
          <Text style={styles.topBadgeText}>{status}</Text>
          <Text style={styles.topBadgeHint}>
            {tracking.tracks.length ? tracking.nextStep : LIVE_VISION.modeDetail}
          </Text>
        </View>

        <View style={styles.topControls}>
          <TouchableOpacity
            style={[
              styles.controlChip,
              torchEnabled && styles.controlChipActive,
              !device.hasTorch && styles.controlChipDisabled,
            ]}
            onPress={() => setTorchEnabled((value) => !value)}
            disabled={!device.hasTorch}
          >
            <Text
              style={[
                styles.controlChipText,
                torchEnabled && styles.controlChipTextActive,
                !device.hasTorch && styles.controlChipTextDisabled,
              ]}
            >
              {device.hasTorch ? (torchEnabled ? 'Torch on' : 'Torch') : 'No torch'}
            </Text>
          </TouchableOpacity>
        </View>

        <View pointerEvents="none" style={styles.scanGuideWrap}>
          <View style={styles.scanGuideFrame} />
          <Text style={styles.scanGuideText}>
            Sweep slowly and keep the patch in focus
          </Text>
        </View>

        <View style={styles.bottom}>
          <View style={styles.zoomControls}>
            {zoomPresets.map((preset) => {
              const selected = Math.abs(zoom - preset.value) < 0.05;

              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.zoomChip, selected && styles.zoomChipSelected]}
                  onPress={() => setZoom(preset.value)}
                >
                  <Text
                    style={[
                      styles.zoomChipText,
                      selected && styles.zoomChipTextSelected,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.scanToggleBtn,
                scanEnabled && styles.scanToggleBtnActive,
              ]}
              onPress={handleToggleScan}
            >
              <Text
                style={[
                  styles.scanToggleBtnText,
                  scanEnabled && styles.scanToggleBtnTextActive,
                ]}
              >
                {scanEnabled ? 'Pause scan' : 'Start scan'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                !tracking.stableTracks.length && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!tracking.stableTracks.length || saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving...' : 'Save current frame'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            {analyzing ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={styles.captureHint}>
              {tracking.stableTracks.length
                ? `${tracking.stableTracks.length} stable lock${tracking.stableTracks.length === 1 ? '' : 's'}`
                : tracking.candidateTracks.length
                  ? `${tracking.candidateTracks.length} candidate track${tracking.candidateTracks.length === 1 ? '' : 's'}`
                  : scanEnabled
                    ? `Detector every ${Math.round(LIVE_VISION.scanIntervalMs / 100) / 10}s` 
                    : 'Scan paused'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08110C' },
  boxLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 14,
  },
  detectionBoxStable: {
    borderColor: '#8EF14A',
    backgroundColor: 'rgba(142, 241, 74, 0.08)',
  },
  detectionBoxCandidate: {
    borderColor: '#FFD76A',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 215, 106, 0.08)',
  },
  detectionLabel: {
    position: 'absolute',
    top: -2,
    left: -2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  detectionLabelStable: {
    backgroundColor: '#8EF14A',
  },
  detectionLabelCandidate: {
    backgroundColor: '#FFD76A',
  },
  detectionLabelText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detectionLabelTextStable: {
    color: '#10210F',
  },
  detectionLabelTextCandidate: {
    color: '#3F3000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingTop: 64,
    paddingBottom: 52,
    paddingHorizontal: 20,
  },
  topBadge: {
    backgroundColor: 'rgba(9, 19, 13, 0.8)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    marginRight: 88,
  },
  topBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  topBadgeSuccess: {
    backgroundColor: 'rgba(24, 72, 33, 0.9)',
  },
  topBadgeWarn: {
    backgroundColor: 'rgba(74, 60, 20, 0.9)',
  },
  topBadgeNeutral: {
    backgroundColor: 'rgba(36, 49, 42, 0.88)',
  },
  topBadgeTitle: {
    color: '#CDE7D1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  engineChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  engineChipText: {
    color: '#F8FFF2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  topBadgeHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  topControls: {
    position: 'absolute',
    top: 72,
    right: 20,
    alignItems: 'flex-end',
  },
  controlChip: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  controlChipActive: {
    backgroundColor: '#EAF6D7',
  },
  controlChipDisabled: {
    opacity: 0.45,
  },
  controlChipText: {
    color: '#213127',
    fontWeight: '600',
    fontSize: 13,
  },
  controlChipTextActive: {
    color: '#234B27',
  },
  controlChipTextDisabled: {
    color: '#667368',
  },
  scanGuideWrap: {
    alignItems: 'center',
    marginTop: 48,
  },
  scanGuideFrame: {
    width: '88%',
    height: '48%',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  scanGuideText: {
    marginTop: 14,
    color: '#F8FFF2',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottom: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 12,
  },
  zoomControls: {
    flexDirection: 'row',
    gap: 10,
  },
  zoomChip: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  zoomChipSelected: {
    backgroundColor: '#EAF6D7',
  },
  zoomChipText: {
    color: '#2A332C',
    fontWeight: '700',
    fontSize: 13,
  },
  zoomChipTextSelected: {
    color: '#234B27',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  scanToggleBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  scanToggleBtnActive: {
    backgroundColor: '#EAF6D7',
  },
  scanToggleBtnText: {
    color: '#223425',
    fontSize: 15,
    fontWeight: '700',
  },
  scanToggleBtnTextActive: {
    color: '#234B27',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  captureHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  permissionText: {
    fontSize: 18,
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
    lineHeight: 26,
  },
  deviceLoadingText: {
    marginTop: 20,
  },
  permissionBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  permissionBtnText: { color: '#fff', fontSize: 15 },
});
