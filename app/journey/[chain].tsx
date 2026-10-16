import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, usePalette } from '@/constants/theme';
import { SHARE_URL } from '@/src/config/links';
import { t } from '@/src/i18n';
import { myJourneys, type Journey } from '@/src/services/sharing';
import { JourneyCard } from '@/src/ui/JourneyCard';
import { PrimaryButton } from '@/src/ui/PrimaryButton';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

const PIN_GREEN = require('@/assets/map/pin-green.png');
const PIN_GOLD = require('@/assets/map/pin-gold.png');

/** Where one chain of luck has been: city-level stops (0.1°) joined in order on a world map. */
export default function JourneyMap() {
  const { chain } = useLocalSearchParams<{ chain: string }>();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [journey, setJourney] = useState<Journey | null>();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    myJourneys()
      .then((list) => setJourney(list.find((j) => j.chain === chain) ?? null))
      .catch((error) => {
        console.warn('journey: load failed', error);
        setJourney(null);
      });
  }, [chain]);

  const stops = (journey?.route ?? []).map((hop, i) => ({ ...hop, i }));
  const points = stops
    .filter((s) => typeof s.la === 'number' && typeof s.lo === 'number')
    .map((s) => ({ i: s.i, city: s.c, coordinate: { latitude: s.la!, longitude: s.lo! } }));
  const share = async () => {
    setSharing(true);
    try {
      // 1080 px wide: crisp in feeds and messengers.
      const uri = await captureRef(cardRef, { format: 'png', result: 'tmpfile', width: 1080 });
      await Share.open({
        url: uri.startsWith('file://') ? uri : `file://${uri}`,
        type: 'image/png',
        message: t.shareLink(SHARE_URL),
        failOnCancel: false,
      });
    } catch (error) {
      console.warn('journey: share failed', error);
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <ScreenHeader title={t.journeyTitle} />
      {journey === undefined ? (
        <ActivityIndicator style={styles.center} color={palette.primary} />
      ) : journey === null ? (
        <Text style={[styles.note, { color: palette.muted }]}>{t.mapError}</Text>
      ) : (
        <>
          <View style={styles.mapBox}>
            {points.length ? (
              <MapView
                ref={map}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={{ ...points[0].coordinate, latitudeDelta: 30, longitudeDelta: 30 }}
                toolbarEnabled={false}
                onMapReady={() =>
                  map.current?.fitToCoordinates(
                    points.map((p) => p.coordinate),
                    { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: false },
                  )
                }
              >
                <Polyline coordinates={points.map((p) => p.coordinate)} strokeColor={palette.primary} strokeWidth={4} geodesic />
                {points.map((p, k) => (
                  <Marker
                    key={p.i}
                    coordinate={p.coordinate}
                    title={`${p.i + 1}. ${p.city ?? '?'}`}
                    // The start and the furthest point are gold; stops between are green.
                    image={k === 0 || k === points.length - 1 ? PIN_GOLD : PIN_GREEN}
                    anchor={{ x: 0.5, y: 0.94 }}
                    tracksViewChanges={false}
                  />
                ))}
              </MapView>
            ) : (
              <Text style={[styles.note, { color: palette.muted }]}>{t.journeyNoMap}</Text>
            )}
          </View>
          <ScrollView contentContainerStyle={[styles.info, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.cardWrap}>
              <JourneyCard
                ref={cardRef}
                route={journey.route}
                hops={journey.hops}
                cameHome={journey.came_home}
                messageKey={journey.message_key}
                cardKey={journey.card_key}
              />
            </View>
            <PrimaryButton icon="share-social" label={t.journeyShare} onPress={share} loading={sharing} />
            {stops.map((s) => (
              <View key={s.i} style={styles.stop}>
                <View style={[styles.dot, { backgroundColor: palette.primary }]}>
                  <Text style={[styles.dotText, { color: palette.onPrimary }]}>{s.i + 1}</Text>
                </View>
                <Text style={[styles.city, { color: palette.text }]}>{s.c ?? '?'}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { marginTop: 48 },
  mapBox: { height: '45%', marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', justifyContent: 'center' },
  note: { fontFamily: FONT.body, fontSize: 15, textAlign: 'center', padding: 24 },
  info: { padding: 16, gap: 10 },
  cardWrap: { alignItems: 'center' },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontFamily: FONT.medium, fontSize: 13 },
  city: { fontFamily: FONT.body, fontSize: 15 },
});
