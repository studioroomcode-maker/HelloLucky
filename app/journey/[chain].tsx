import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams } from 'expo-router';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as MediaLibrary from 'expo-media-library';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, usePalette } from '@/constants/theme';
import { JourneyVideo, type VideoLayer } from '@/modules/journey-video';
import { shareLine } from '@/src/config/links';
import { copyShareText } from '@/src/shareText';
import { ARROW, lang, stringsForCountry, t } from '@/src/i18n';
import { arcDegrees, greatCirclePoint } from '@/src/journeyMap';
import { flagEmoji, letterMessage, myPlace } from '@/src/letters';
import { nickname } from '@/src/nicknames';
import { useFinds, useSettings } from '@/src/services/findsStore';
import { countryCodeAt } from '@/src/services/location';
import { myJourneys, type Journey } from '@/src/services/sharing';
import { bubbleAt, JourneyCard, tripDone, tripMs, tripProgress } from '@/src/ui/JourneyCard';
import { CARDS } from '@/src/ui/LuckCard';
import { PrimaryButton } from '@/src/ui/PrimaryButton';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

const PIN_GREEN = require('@/assets/map/pin-green.png');
const PIN_GOLD = require('@/assets/map/pin-gold.png');
// Where the map rests when it opens and after a replay: around me, about a country across.
const HOME_ZOOM = 5;
// The stop pins (assets/map/pin-*.png) stand 58 dp tall with their tip at 94%: the letter bubble sits just above.
const PIN_TOP = 58 * 0.94;
// The trip video: 9:16 for stories and reels, drawn frame by frame (the map can't be screen-recorded).
const FPS = 15;
const VIDEO_W = 720;
const VIDEO_H = 1280;
const MARK = 'journey-video';

type Box = { x: number; y: number; width: number; height: number };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** A view as a PNG file URI (for the video's overlays). */
const shot = async (ref: React.RefObject<View | null>, format: 'png' | 'jpg' = 'png') => {
  const uri = await captureRef(ref, { format, quality: 0.9, result: 'tmpfile' });
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};
const layerAt = (uri: string, box: Box, scale: number): VideoLayer => ({
  uri,
  x: box.x * scale,
  y: box.y * scale,
  width: box.width * scale,
  height: box.height * scale,
  fit: 'contain',
});

/** A camera zoom that shows a leg `arc`° long with room around it while the camera follows it. */
const legZoom = (arc: number) => Math.min(6, Math.max(1.5, Math.log2(540 / (2.5 * Math.max(arc, 1)))));

/** Where one chain of luck has been: city-level stops (0.1°) joined in order on a world map. */
export default function JourneyMap() {
  // `autoplay` (from the passport's longest relay) flies the trip as soon as the map is up.
  const { chain, autoplay } = useLocalSearchParams<{ chain: string; autoplay?: string }>();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [journey, setJourney] = useState<Journey | null>();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Each number replays the card's trip; undefined shows it finished (for the capture).
  const [play, setPlay] = useState<number | undefined>(0);
  // While the map replays the trip: how many legs its line has grown (fractional); undefined shows it all.
  const [drawn, setDrawn] = useState<number>();
  const drawnRef = useRef<number>(undefined);
  drawnRef.current = drawn;
  // The trip clock in stop units while it replays (for the letter bubble); undefined hides the bubble.
  const [at, setAt] = useState<number>();
  // The replay has landed (shows who the trip came home to).
  const [landed, setLanded] = useState(false);
  // Making the trip video: its progress (0-100) while it records.
  const [recording, setRecording] = useState<number>();
  const recordingRef = useRef<number>(undefined);
  recordingRef.current = recording;
  const box = useRef<Box>({ x: 0, y: 0, width: 0, height: 0 });
  const boxRef = useRef<View>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const pillRef = useRef<View>(null);
  const pillBox = useRef<Box>({ x: 0, y: 0, width: 0, height: 0 });
  const bubbleRef = useRef<View>(null);
  const bubbleBox = useRef<Box>({ x: 0, y: 0, width: 0, height: 0 });
  const markRef = useRef<View>(null);
  const markBox = useRef<Box>({ x: 0, y: 0, width: 0, height: 0 });
  const frame = useRef(0);
  const autoplayed = useRef(false);
  const [mapOpen, setMapOpen] = useState(true);
  // Country code per stop index, filled in as the OS geocoder answers.
  const [countries, setCountries] = useState<Record<number, string>>({});
  const { journeyFinds, nickname: myName } = useSettings();
  const finds = useFinds();
  // My clover for a journey I started from a find; the samples borrow my latest one.
  const source = journeyFinds[chain] ? finds.find((f) => f.id === journeyFinds[chain]) : chain.startsWith('sample-') ? finds[0] : undefined;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Me: where the phone last was (only if location is already allowed; never prompt for this), else my newest find.
  const [here, setHere] = useState<{ latitude: number; longitude: number }>();
  useEffect(() => {
    (async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      const last = granted ? await Location.getLastKnownPositionAsync().catch(() => null) : null;
      if (last) setHere({ latitude: last.coords.latitude, longitude: last.coords.longitude });
    })().catch(() => {});
  }, []);

  useEffect(() => {
    myJourneys()
      .then((list) => setJourney(list.find((j) => j.chain === chain) ?? null))
      .catch((error) => {
        console.warn('journey: load failed', error);
        setJourney(null);
      });
  }, [chain]);

  useEffect(() => {
    let cancelled = false;
    (journey?.route ?? []).forEach((hop, i) => {
      if (typeof hop.la !== 'number' || typeof hop.lo !== 'number') return;
      countryCodeAt(hop.la, hop.lo).then((code) => {
        if (code && !cancelled) setCountries((prev) => ({ ...prev, [i]: code }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [journey]);

  const stops = (journey?.route ?? []).map((hop, i) => ({ ...hop, i }));
  const points = stops
    .filter((s) => typeof s.la === 'number' && typeof s.lo === 'number')
    .map((s) => ({ i: s.i, city: s.c, coordinate: { latitude: s.la!, longitude: s.lo! } }));
  const legs = Math.max(points.length - 1, 0);
  const mine = myPlace(finds);
  const home =
    here ??
    (typeof mine?.lat === 'number' && typeof mine?.lng === 'number' ? { latitude: mine.lat, longitude: mine.lng } : points[0]?.coordinate);
  const goHome = (animated: boolean) => {
    if (!home) return;
    if (animated) map.current?.animateCamera({ center: home, zoom: HOME_ZOOM, heading: 0, pitch: 0 }, { duration: 900 });
    else map.current?.setCamera({ center: home, zoom: HOME_ZOOM, heading: 0, pitch: 0 });
  };
  // The phone's position can arrive after the map is up: settle there unless the trip is flying.
  const mapReady = useRef(false);
  useEffect(() => {
    if (here && mapReady.current && drawnRef.current === undefined && recordingRef.current === undefined) goHome(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  // The card and the map fly the same trip on the same clock (src/ui/JourneyCard.tsx).
  const playTrip = () => {
    setPlay((n) => (n ?? 0) + 1);
    setLanded(false);
    cancelAnimationFrame(frame.current);
    if (!legs) return;
    const start = Date.now();
    const total = tripMs(legs);
    let zoom = legZoom(tipAt(0).arc);
    const step = () => {
      const ms = Date.now() - start;
      if (ms >= total) {
        setDrawn(undefined);
        setAt(undefined);
        setLanded(true);
        // Back to me once the line is home.
        goHome(true);
        return;
      }
      const done = tripDone(ms, legs);
      const tip = tipAt(done);
      // The camera rides the tip of the line, easing its zoom toward one that fits the current leg.
      zoom += (legZoom(tip.arc) - zoom) * 0.06;
      map.current?.setCamera({ center: tip.coordinate, zoom, heading: 0, pitch: 0 });
      setDrawn(done);
      setAt(tripProgress(ms, legs));
      frame.current = requestAnimationFrame(step);
    };
    step();
  };

  /** Where the growing line ends after `done` legs, on the great circle of the leg it is on. */
  function tipAt(done: number) {
    const k = Math.min(Math.floor(done), legs - 1);
    const a = { la: points[k].coordinate.latitude, lo: points[k].coordinate.longitude };
    const b = { la: points[k + 1].coordinate.latitude, lo: points[k + 1].coordinate.longitude };
    const p = greatCirclePoint(a, b, done - k);
    return { k, arc: arcDegrees(a, b), coordinate: { latitude: p.la, longitude: p.lo } };
  }

  const stopName = (p: (typeof points)[number]) => `${countries[p.i] ? `${flagEmoji(countries[p.i])} ` : ''}${p.city ?? '?'}`;
  let line = points.map((p) => p.coordinate);
  let leg: { sender: string; route: string } | undefined;
  if (drawn !== undefined) {
    const tip = tipAt(drawn);
    line = [...line.slice(0, tip.k + 1), tip.coordinate];
    leg = {
      sender: nickname(journey?.route[points[tip.k].i]?.n, lang),
      route: `${stopName(points[tip.k])} ${ARROW} ${stopName(points[tip.k + 1])}`,
    };
  } else if (landed && journey?.came_home && points.length) {
    // Home again: the starter (me) is the last name on the trip.
    leg = { sender: nickname(myName >= 0 ? myName : journey.route[0]?.n, lang), route: `🍀 ${stopName(points[0])} · ${t.cameHome}` };
  }

  // The letter popping up over the stop the camera rests on (the map's centre), the way it reads there: as I sent
  // it at home, and in the local language at every stop after.
  const bubble = at !== undefined && legs ? bubbleAt(at, legs) : undefined;
  const bubbleStop = bubble ? points[bubble.stop] : undefined;
  const bubbleCountry = bubbleStop ? countries[bubbleStop.i] : undefined;
  const bubbleText =
    bubble && journey
      ? `${bubbleCountry ? `${flagEmoji(bubbleCountry)} ` : ''}${letterMessage(bubble.stop === 0 ? t : stringsForCountry(bubbleCountry), journey.message_key)}`
      : '';
  /** The bubble's box at its current size, grown from its tail (bottom centre), in video pixels. */
  const bubbleLayer = (uri: string, scale: number): VideoLayer => {
    const b = bubbleBox.current;
    const s = bubble?.scale ?? 1;
    return layerAt(uri, { x: b.x + (b.width * (1 - s)) / 2, y: b.y + b.height * (1 - s), width: b.width * s, height: b.height * s }, scale);
  };

  /** The finished card as a 1080 px wide PNG (crisp in feeds and messengers). */
  const captureCard = async () => {
    cancelAnimationFrame(frame.current);
    setDrawn(undefined);
    setPlay(undefined);
    await new Promise((resolve) => setTimeout(resolve, 150)); // let the finished route draw before capturing
    const uri = await captureRef(cardRef, { format: 'png', result: 'tmpfile', width: 1080 });
    return uri.startsWith('file://') ? uri : `file://${uri}`;
  };

  const share = async () => {
    setSharing(true);
    try {
      const url = await captureCard();
      await copyShareText(shareLine(t));
      await Share.open({ url, type: 'image/png', message: shareLine(t), failOnCancel: false });
    } catch (error) {
      console.warn('journey: share failed', error);
    } finally {
      setSharing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Write-only: nothing is read from the photo library (Android 13+ needs no permission at all).
      const { granted } = await MediaLibrary.requestPermissionsAsync(true);
      if (!granted) throw new Error('journey: photo permission denied');
      await MediaLibrary.saveToLibraryAsync(await captureCard());
      Alert.alert(t.journeySaved);
    } catch (error) {
      console.warn('journey: save failed', error);
      Alert.alert(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  /**
   * The trip as a 9:16 MP4 in the photo library: the map flies stop to stop with each sender's name and the watermark,
   * lands, then the journey card closes the clip. Each frame is a map snapshot taken after moving the camera by hand.
   */
  const recordVideo = async () => {
    if (!JourneyVideo || !legs || !journey) return;
    cancelAnimationFrame(frame.current);
    setMapOpen(true);
    setRecording(0);
    await activateKeepAwakeAsync(MARK).catch(() => {});
    const out = `${FileSystem.cacheDirectory}journey-${Date.now()}.mp4`.replace('file://', '');
    try {
      await wait(800); // the map grows to 9:16 and redraws
      if (!map.current || !box.current.width) throw new Error('journey: map not ready');
      const scale = VIDEO_W / box.current.width;
      const mark = layerAt(await shot(markRef), markBox.current, scale);
      let pill: { key: number; layer: VideoLayer } | undefined;
      let letter: { key: number; uri: string } | undefined;
      // One map picture. Android: a map snapshot under the sender pill (captured again when its leg changes), the
      // letter bubble (captured once per stop, then scaled as it pops) and the watermark. iOS: the Google map's own
      // snapshot comes out blank (Metal), so the whole box is captured as it shows.
      const addMap = async (key: number, repeat: number, stop?: number) => {
        await wait(80);
        const snap =
          Platform.OS === 'ios'
            ? await shot(boxRef, 'jpg')
            : await map.current!.takeSnapshot({
                format: 'jpg',
                quality: 0.9,
                result: 'file',
                width: VIDEO_W / PixelRatio.get(),
                height: VIDEO_H / PixelRatio.get(),
              });
        const layers: VideoLayer[] = [{ uri: snap, x: 0, y: 0, width: VIDEO_W, height: VIDEO_H, once: true }];
        if (Platform.OS !== 'ios') {
          if (pillRef.current && pill?.key !== key) pill = { key, layer: layerAt(await shot(pillRef), pillBox.current, scale) };
          if (pillRef.current && pill) layers.push(pill.layer);
          if (bubbleRef.current && stop !== undefined) {
            if (letter?.key !== stop) letter = { key: stop, uri: await shot(bubbleRef) };
            layers.push(bubbleLayer(letter.uri, scale));
          }
          layers.push(mark);
        }
        await JourneyVideo!.addFrame(layers, '#FFFFFF', repeat);
        // Hundreds of frames: don't leave their pictures behind.
        await FileSystem.deleteAsync(snap, { idempotent: true }).catch(() => {});
      };
      await JourneyVideo.start(out, VIDEO_W, VIDEO_H, FPS);
      const frames = Math.ceil((tripMs(legs) / 1000) * FPS);
      let zoom = legZoom(tipAt(0).arc);
      for (let f = 0; f <= frames; f++) {
        const done = tripDone((f * 1000) / FPS, legs);
        const tip = tipAt(done);
        // Same camera as playTrip, eased per video frame instead of per screen frame.
        zoom += (legZoom(tip.arc) - zoom) * 0.2;
        map.current.setCamera({ center: tip.coordinate, zoom, heading: 0, pitch: 0 });
        setDrawn(done);
        const p = tripProgress((f * 1000) / FPS, legs);
        setAt(p);
        await addMap(tip.k, 1, bubbleAt(p, legs)?.stop);
        setRecording(Math.round((f / frames) * 90));
      }
      // Landed: the camera holds where the last leg ended, the letter still up (home again, my name shows), then the card.
      setDrawn(undefined);
      setLanded(true);
      await addMap(-1, Math.round(FPS * 1.5), legs);
      const card = await captureCard();
      const pad = 48;
      await JourneyVideo.addFrame(
        [{ uri: card, x: pad, y: pad, width: VIDEO_W - pad * 2, height: VIDEO_H - pad * 2, fit: 'contain' }],
        CARDS[journey.card_key % CARDS.length].bg,
        FPS * 3,
      );
      // Background music (Suno, made under a paid plan): faded out wherever the video ends.
      const [music] = await Asset.loadAsync(require('@/assets/audio/journey.m4a')).catch(() => []);
      const file = await JourneyVideo.finish(music?.localUri ?? null);
      setRecording(100);
      const { granted } = await MediaLibrary.requestPermissionsAsync(true);
      if (!granted) throw new Error('journey: photo permission denied');
      await MediaLibrary.saveToLibraryAsync(`file://${file}`);
      Alert.alert(t.journeyVideoSaved);
    } catch (error) {
      console.warn('journey: video failed', error);
      await JourneyVideo.cancel().catch(() => {});
      Alert.alert(t.saveError);
    } finally {
      setRecording(undefined);
      setAt(undefined);
      setLanded(false);
      deactivateKeepAwake(MARK);
      goHome(true);
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
          {/* While the video records, its progress sits here: above the map box, so it never ends up in the frames. */}
          {recording !== undefined ? (
            <View style={[styles.rendering, { backgroundColor: palette.primary }]} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={palette.onPrimary} />
              <Text style={[styles.renderingText, { color: palette.onPrimary }]}>{t.journeyVideoMaking(recording)}</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setMapOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: mapOpen }}
              hitSlop={6}
              style={({ pressed }) => [styles.mapToggle, { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="map-outline" size={16} color={palette.muted} />
              <Text style={[styles.mapToggleText, { color: palette.muted }]}>{mapOpen ? t.journeyMapHide : t.journeyMapShow}</Text>
              <Ionicons name={mapOpen ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} />
            </Pressable>
          )}
          {mapOpen ? (
            <View
              ref={boxRef}
              collapsable={false}
              style={[styles.mapBox, recording !== undefined && boxWidth ? { height: (boxWidth * VIDEO_H) / VIDEO_W } : null]}
              onLayout={(e) => {
                box.current = e.nativeEvent.layout;
                setBoxWidth(e.nativeEvent.layout.width);
              }}
            >
              {points.length ? (
                <MapView
                  ref={map}
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
                  initialRegion={{ ...(home ?? points[0].coordinate), latitudeDelta: 30, longitudeDelta: 30 }}
                  toolbarEnabled={false}
                  // Held still while the video records: a drag would end up in the frames.
                  scrollEnabled={recording === undefined}
                  zoomEnabled={recording === undefined}
                  rotateEnabled={recording === undefined}
                  pitchEnabled={recording === undefined}
                  onMapReady={() => {
                    mapReady.current = true;
                    goHome(false);
                    if (autoplay && !autoplayed.current) {
                      autoplayed.current = true;
                      playTrip();
                    }
                  }}
                >
                  <Polyline coordinates={line} strokeColor={palette.primary} strokeWidth={4} geodesic />
                  {/* A stop's pin appears once the line reaches it. */}
                  {points
                    .filter((_, k) => drawn === undefined || k <= drawn + 1e-6)
                    .map((p, k) => (
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
              {/* While the trip flies: who sent this leg, and from where to where; once it lands home, me. */}
              {leg ? (
                <View
                  ref={pillRef}
                  collapsable={false}
                  onLayout={(e) => (pillBox.current = e.nativeEvent.layout)}
                  pointerEvents="none"
                  style={[styles.legInfo, { backgroundColor: palette.surface }]}
                >
                  {leg.sender ? <Text style={[styles.legSender, { color: palette.text }]}>{leg.sender}</Text> : null}
                  <Text style={[styles.legRoute, { color: palette.muted }]} numberOfLines={1}>
                    {leg.route}
                  </Text>
                </View>
              ) : null}
              {/* The letter, popping up over the stop the camera rests on. The scaled wrapper is for the eye; the inner
                  view is captured for the video at full size and scaled into its frame. */}
              {bubble && bubbleText ? (
                <View
                  pointerEvents="none"
                  onLayout={(e) => (bubbleBox.current = e.nativeEvent.layout)}
                  style={[styles.bubble, { transform: [{ scale: bubble.scale }] }]}
                >
                  <View ref={bubbleRef} collapsable={false} style={styles.bubbleInner}>
                    <View style={styles.bubbleBody}>
                      <Text style={styles.bubbleText} numberOfLines={3}>
                        {bubbleText}
                      </Text>
                    </View>
                    <View style={styles.bubbleTail} />
                  </View>
                </View>
              ) : null}
              {/* Only while recording: the watermark stamped on every map frame (with the map's attribution). */}
              {recording !== undefined ? (
                <View
                  ref={markRef}
                  collapsable={false}
                  onLayout={(e) => (markBox.current = e.nativeEvent.layout)}
                  pointerEvents="none"
                  style={styles.mark}
                >
                  <Image source={require('@/assets/logo.png')} style={styles.markLogo} contentFit="contain" tintColor="#1F7A36" />
                  <Text style={styles.markNote}>Map data ©Google</Text>
                </View>
              ) : null}
              {legs && recording === undefined ? (
                <Pressable
                  onPress={playTrip}
                  accessibilityRole="button"
                  accessibilityLabel={t.journeyReplay}
                  hitSlop={8}
                  style={({ pressed }) => [styles.play, { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Ionicons name="play" size={24} color={palette.onPrimary} style={styles.playIcon} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView contentContainerStyle={[styles.info, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable onPress={playTrip} accessibilityRole="button" accessibilityLabel={t.journeyReplay} style={styles.cardWrap}>
              <JourneyCard
                ref={cardRef}
                route={journey.route}
                hops={journey.hops}
                cameHome={journey.came_home}
                messageKey={journey.message_key}
                cardKey={journey.card_key}
                play={play}
                countries={countries}
                photo={source?.cloverUri ?? source?.photoUri}
              />
            </Pressable>
            <PrimaryButton icon="share-social" label={t.journeyShare} onPress={share} loading={sharing} />
            <PrimaryButton icon="download-outline" label={t.journeySave} onPress={save} loading={saving} variant="secondary" />
            {JourneyVideo && legs ? (
              <PrimaryButton
                icon="videocam-outline"
                label={recording === undefined ? t.journeyVideo : t.journeyVideoMaking(recording)}
                onPress={recordVideo}
                disabled={recording !== undefined}
                variant="secondary"
              />
            ) : null}
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
  play: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  mark: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  markLogo: { width: 64, height: 30 },
  markNote: { fontFamily: FONT.body, fontSize: 8, color: '#444' },
  playIcon: { marginLeft: 3 }, // the triangle looks centred a little right of the middle
  mapToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapToggleText: { fontFamily: FONT.medium, fontSize: 13 },
  rendering: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    borderRadius: 16,
  },
  renderingText: { fontFamily: FONT.cute, fontSize: 14 },
  legInfo: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    maxWidth: '90%',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  legSender: { fontFamily: FONT.cute, fontSize: 15 },
  legRoute: { fontFamily: FONT.medium, fontSize: 13 },
  // Anchored over the map's centre, where the camera rests on each stop; grows from its tail.
  bubble: { position: 'absolute', alignSelf: 'center', bottom: '50%', marginBottom: PIN_TOP + 2, maxWidth: '72%', transformOrigin: 'bottom' },
  bubbleInner: { alignItems: 'center' },
  bubbleBody: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubbleText: { fontFamily: FONT.cute, fontSize: 12.5, lineHeight: 17, color: '#1E2A22', textAlign: 'center' },
  bubbleTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
  },
});
