import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraColors, FONT } from '@/constants/theme';
import { t } from '@/src/i18n';
import { saveCapture } from '@/src/services/capture';
import { wideScan, type WideCandidate } from '@/src/services/detector/wideScan';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

/** Size of the zoomed preview of one candidate, in dp. */
const ZOOM = 220;

/** Wide scan result: the photo with candidate boxes; tap one to look closely, then keep it as a find. */
export default function WideScan() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [candidates, setCandidates] = useState<WideCandidate[]>();
  const [uri, setUri] = useState<string>();
  const [aspect, setAspect] = useState<number>();
  const [view, setView] = useState({ width: 0, height: 0 });
  const [picked, setPicked] = useState<number>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    wideScan(path, (done, total) => alive && setProgress([done, total]))
      .then((result) => {
        if (!alive) return;
        setUri(result.uri);
        setCandidates(result.candidates);
        const found = result.candidates;
        if (found.length) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      })
      .catch((error) => {
        console.warn('wide: scan failed', error);
        if (alive) Alert.alert(t.wideError, undefined, [{ text: t.close, onPress: () => router.back() }]);
      });
    return () => {
      alive = false;
    };
  }, [path, router]);

  // The photo is drawn with contentFit="contain"; boxes use the same letterboxed rectangle.
  const fit = (() => {
    if (!aspect || !view.width) return undefined;
    const width = Math.min(view.width, view.height * aspect);
    const height = width / aspect;
    return { left: (view.width - width) / 2, top: (view.height - height) / 2, width, height };
  })();

  const save = async () => {
    setSaving(true);
    try {
      // Keep the upright image the boxes were drawn on.
      // Close-up of the candidate the user looked at, else the most confident one.
      const box = pick ?? [...(candidates ?? [])].sort((a, b) => b.confidence - a.confidence)[0];
      const id = await saveCapture(uri ?? path, true, box);
      router.replace({ pathname: '/find/[id]', params: { id, fresh: '1' } });
    } catch (error) {
      console.warn('wide: save failed', error);
      Alert.alert(t.saveError);
      setSaving(false);
    }
  };

  const scanning = candidates === undefined;
  const pick = picked !== undefined && candidates ? candidates[picked] : undefined;
  const status = scanning
    ? t.wideScanning(Math.min(progress[0] + 1, progress[1] || 1), progress[1] || 1)
    : candidates.length
      ? t.wideFound(candidates.length)
      : t.wideNone;

  return (
    <View style={styles.container}>
      <View style={styles.photo} onLayout={(e: LayoutChangeEvent) => setView(e.nativeEvent.layout)}>
        <Image
          source={uri ? { uri } : undefined}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          onLoad={(e) => setAspect(e.source.width / e.source.height)}
          accessibilityIgnoresInvertColors
        />
        {fit && candidates
          ? candidates.map((c, i) => (
              <Pressable
                key={i}
                onPress={() => setPicked(i)}
                accessibilityRole="button"
                accessibilityLabel={`${t.wideHint} ${i + 1}`}
                hitSlop={12}
                style={[
                  styles.box,
                  {
                    left: fit.left + (c.x - c.width / 2) * fit.width,
                    top: fit.top + (c.y - c.height / 2) * fit.height,
                    width: c.width * fit.width,
                    height: c.height * fit.height,
                  },
                  picked === i && styles.boxPicked,
                ]}
              />
            ))
          : null}
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.close} style={styles.roundBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={[styles.status, !scanning && candidates.length > 0 && styles.statusFound]} accessibilityLiveRegion="polite">
          {scanning ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={[styles.statusText, !scanning && candidates.length > 0 && styles.statusTextFound]}>{status}</Text>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {pick && aspect ? (
          // Zoomed look at the picked candidate: the photo scaled so the box (plus a margin) fills the square.
          <View style={styles.zoom}>
            {(() => {
              const side = Math.max(pick.width, pick.height / aspect) * 1.8;
              const scale = ZOOM / side;
              return (
                <Image
                  source={{ uri: uri! }}
                  contentFit="fill"
                  style={{
                    position: 'absolute',
                    width: scale,
                    height: scale / aspect,
                    left: ZOOM / 2 - pick.x * scale,
                    top: ZOOM / 2 - (pick.y * scale) / aspect,
                  }}
                />
              );
            })()}
          </View>
        ) : null}
        {!scanning && candidates.length ? (
          <>
            {pick ? null : <Text style={styles.hint}>{t.wideHint}</Text>}
            <PrimaryButton icon="heart" label={t.wideSave} onPress={save} loading={saving} />
          </>
        ) : null}
        {!scanning ? (
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.retry}>
            <Text style={styles.retryText}>{t.wideRetry}</Text>
          </Pressable>
        ) : null}
      </View>
      <LuckBurst trigger={candidates?.length ? 1 : 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  photo: { ...StyleSheet.absoluteFillObject },
  box: { position: 'absolute', borderWidth: 3, borderRadius: 12, borderColor: CameraColors.lock },
  boxPicked: { borderWidth: 4, borderColor: '#fff' },
  top: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: CameraColors.scrim, alignItems: 'center', justifyContent: 'center' },
  status: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CameraColors.scrim,
  },
  statusFound: { backgroundColor: CameraColors.lock },
  statusText: { color: '#fff', fontSize: 15, fontFamily: FONT.cute, textAlign: 'center', flexShrink: 1 },
  statusTextFound: { color: '#10210F' },
  bottom: { position: 'absolute', left: 20, right: 20, bottom: 0, alignItems: 'stretch', gap: 12 },
  zoom: { alignSelf: 'center', width: ZOOM, height: ZOOM, borderRadius: 24, overflow: 'hidden', borderWidth: 3, borderColor: '#fff', backgroundColor: '#000' },
  hint: {
    fontFamily: FONT.body,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  retry: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 18, backgroundColor: CameraColors.scrim },
  retryText: { fontFamily: FONT.medium, color: '#fff', fontSize: 15 },
});
