import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, FONT } from '@/constants/theme';
import { formatDate, t } from '@/src/i18n';
import { getSettings, updateSettings, useSettings } from '@/src/services/findsStore';
import { cloverPhotoUrl, currentUserId, fetchShared, reportFind, sharingAvailable, type SharedFind } from '@/src/services/sharing';

const PIN_GREEN = require('@/assets/map/pin-green.png');
const PIN_GOLD = require('@/assets/map/pin-gold.png');

const WORLD: Region = { latitude: 30, longitude: 127, latitudeDelta: 80, longitudeDelta: 80 };

function regionBounds(r: Region) {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
  const wide = r.longitudeDelta >= 359;
  return {
    south: clamp(r.latitude - r.latitudeDelta / 2, -90, 90),
    north: clamp(r.latitude + r.latitudeDelta / 2, -90, 90),
    west: wide ? -180 : wrap(r.longitude - r.longitudeDelta / 2),
    east: wide ? 180 : wrap(r.longitude + r.longitudeDelta / 2),
  };
}

export default function LuckyMap() {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { hiddenPins, blockedUsers } = useSettings();
  const [initial, setInitial] = useState<Region>();
  const [showUser, setShowUser] = useState(false);
  const [items, setItems] = useState<SharedFind[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<SharedFind>();
  const [me, setMe] = useState<string>();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastRegion = useRef<Region>(WORLD);

  useEffect(() => {
    currentUserId().then(setMe).catch(() => {});
    (async () => {
      // Start near the user when we already may read location; never prompt just for the map.
      const { granted } = await Location.getForegroundPermissionsAsync();
      setShowUser(granted);
      const last = granted ? await Location.getLastKnownPositionAsync().catch(() => null) : null;
      setInitial(
        last
          ? { latitude: last.coords.latitude, longitude: last.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
          : WORLD,
      );
    })();
  }, []);

  const load = useCallback(async (region: Region) => {
    lastRegion.current = region;
    setLoading(true);
    try {
      setItems(await fetchShared(regionBounds(region)));
      setFailed(false);
    } catch (error) {
      console.warn('map: load failed', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const visible = items.filter((item) => !hiddenPins.includes(item.id) && !blockedUsers.includes(item.user_id));
  const photo = selected && cloverPhotoUrl(selected);

  // Report / block for other people's pins (Apple guideline 1.2); both hide on this device right away.
  const openMenu = (item: SharedFind) => {
    const hide = (patch: Parameters<typeof updateSettings>[0]) => {
      setSelected(undefined);
      updateSettings(patch).catch(() => {});
    };
    Alert.alert(t.mapMore, undefined, [
      ...(cloverPhotoUrl(item)
        ? [
            {
              text: t.reportPhoto,
              style: 'destructive' as const,
              onPress: () => {
                hide({ hiddenPins: [...getSettings().hiddenPins, item.id] });
                reportFind(item.id)
                  .then(() => Alert.alert(t.reported))
                  .catch(() => Alert.alert(t.shareError));
              },
            },
          ]
        : []),
      { text: t.blockUser, onPress: () => hide({ blockedUsers: [...getSettings().blockedUsers, item.user_id] }) },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const onRegionChangeComplete = (region: Region) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(region), 400);
  };


  if (!sharingAvailable) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.message, { color: palette.muted }]}>{t.mapUnavailable}</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {initial ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initial}
          showsUserLocation={showUser}
          showsMyLocationButton={showUser}
          toolbarEnabled={false}
          onMapReady={() => load(initial)}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={() => setSelected(undefined)}
          mapPadding={{ top: insets.top + 64, right: 0, bottom: selected ? 190 : 0, left: 0 }}
        >
          {visible.map((item) => (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              // Bitmap pins (assets/map, @2x/@3x): custom marker views get clipped on Android's new architecture.
              image={item.user_id === me ? PIN_GOLD : PIN_GREEN}
              anchor={{ x: 0.5, y: 0.94 }}
              tracksViewChanges={false}
              onPress={(event) => {
                event.stopPropagation();
                setSelected(item);
              }}
            />
          ))}
        </MapView>
      ) : (
        <View style={[styles.center, { backgroundColor: palette.background }]}>
          <ActivityIndicator color={palette.primary} />
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.close}
          style={[styles.roundBtn, { backgroundColor: palette.surface }]}
        >
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </Pressable>
        <View style={[styles.titleChip, { backgroundColor: palette.surface }]}>
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
            {t.mapTitle}
          </Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            {failed ? t.mapError : !loading && visible.length === 0 ? t.mapEmpty : t.mapSubtitle}
          </Text>
        </View>
        {loading ? (
          <View style={[styles.roundBtn, { backgroundColor: palette.surface }]}>
            <ActivityIndicator size="small" color={palette.primary} />
          </View>
        ) : (
          <Pressable
            onPress={() => load(lastRegion.current)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.mapTitle}
            style={[styles.roundBtn, { backgroundColor: palette.surface }]}
          >
            <Ionicons name="refresh" size={22} color={palette.text} />
          </Pressable>
        )}
      </View>

      {selected ? (
        <View style={[styles.card, { backgroundColor: palette.surface, paddingBottom: insets.bottom + 16 }]}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={[styles.photo, { backgroundColor: palette.background }]}
              contentFit="cover"
              transition={150}
              accessibilityLabel={t.mapPhoto}
            />
          ) : null}
          <View style={styles.cardBody}>
            <Text style={[styles.cardDate, { color: palette.text }]}>{formatDate(selected.found_at)}</Text>
            {selected.place ? (
              <Text style={[styles.cardPlace, { color: palette.muted }]} numberOfLines={2}>
                {selected.place}
              </Text>
            ) : null}
            {selected.user_id === me ? (
              <Text style={[styles.mine, { color: palette.gold }]}>{t.mapMine}</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`,
                  ).catch(() => {})
                }
                accessibilityRole="link"
                style={[styles.action, { backgroundColor: palette.primary }]}
              >
                <Ionicons name="navigate" size={16} color={palette.onPrimary} />
                <Text style={[styles.actionText, { color: palette.onPrimary }]}>{t.directions}</Text>
              </Pressable>
            </View>
          </View>
          {selected.user_id !== me ? (
            <Pressable onPress={() => openMenu(selected)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.mapMore} style={styles.more}>
              <Ionicons name="ellipsis-horizontal" size={22} color={palette.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontFamily: FONT.body, fontSize: 16, textAlign: 'center' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  titleChip: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  title: { fontSize: 16, fontFamily: FONT.cute },
  subtitle: { fontFamily: FONT.body, fontSize: 12 },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  cardBody: { flex: 1, gap: 4, paddingRight: 24 },
  photo: { width: 112, height: 112, borderRadius: 16 },
  more: { position: 'absolute', top: 12, right: 14, padding: 4 },
  cardDate: { fontSize: 17, fontFamily: FONT.cute },
  cardPlace: { fontFamily: FONT.body, fontSize: 14 },
  mine: { fontSize: 13, fontFamily: FONT.cute },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 'auto' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  actionText: { fontSize: 14, fontFamily: FONT.cute },
});
