import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, usePalette } from '@/constants/theme';
import { t } from '@/src/i18n';
import { fitView, landDots, paintCells } from '@/src/journeyMap';
import { passportStamps, type Stamp } from '@/src/letters';
import { useFinds } from '@/src/services/findsStore';
import { letterClover, myJourneys, myLetters, type Journey, type KeptLetter } from '@/src/services/sharing';
import { Confetti } from '@/src/ui/art';
import { CARDS } from '@/src/ui/LuckCard';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

// A passport is a physical thing: the same green cover and cream page in light and dark mode.
const COVER = '#1F7A36';
const GILT = '#F5D77A';
const PAPER = '#FFFBEF';
const PAPER_EDGE = '#EADFC4';
const PAPER_INK = '#6B5B3A';
const COLUMNS = 3;
const GAP = 12;
const STAGGER_MS = 110;
const FIRST_MS = 250;
const MAX_STAGGERED = 15; // later stamps land together, so a long passport doesn't keep you waiting
const MAP_ASPECT = 1.75;
const MAP_ACROSS = 60; // land dots per row
const PAINT_END_MS = FIRST_MS + MAX_STAGGERED * STAGGER_MS + 400;

/** Each stamp thumps down: big and faint, then pressed flat with a little bounce. */
const stampIn =
  (delay: number): EntryExitAnimationFunction =>
  () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: 1.8 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 90 })),
        transform: [{ scale: withDelay(delay, withSpring(1, { damping: 11, stiffness: 320, mass: 0.6 })) }],
      },
    };
  };

const stampDelay = (i: number) => FIRST_MS + Math.min(i, MAX_STAGGERED) * STAGGER_MS;

function hash(text: string) {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** My clover's passport: a stamp for every city the luck I sent or passed on has visited. */
export default function Passport() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [journeys, setJourneys] = useState<Journey[]>();
  const [failed, setFailed] = useState(false);
  const [letters, setLetters] = useState<KeptLetter[]>([]);
  // The stamp whose clovers are open in the sheet.
  const [city, setCity] = useState<string>();
  const finds = useFinds();

  useEffect(() => {
    myJourneys().then(setJourneys, (error) => {
      console.warn('passport: load failed', error);
      setFailed(true);
    });
    myLetters().then(setLetters, (error) => console.warn('passport: letters failed', error));
  }, []);

  // Clovers on the cheers I received from that city.
  const clovers = letters.flatMap((l) => {
    const uri = l.origin?.trim() === city ? letterClover(l, finds[0]?.cloverUri) : undefined;
    return uri ? [{ key: l.letter, uri }] : [];
  });

  const stamps = useMemo(() => passportStamps(journeys ?? []), [journeys]);
  const cityInk = CARDS[(stamps.find((s) => s.city === city)?.card ?? 0) % CARDS.length].ink;
  // The longest relay (newest on a tie, as myJourneys sorts newest first) opens on its map and flies straight away.
  const longestTrip = (journeys ?? []).reduce<Journey | undefined>((best, j) => (!best || j.hops > best.hops ? j : best), undefined);
  const longest = longestTrip?.hops ?? 0;
  const openLongest = () =>
    longestTrip && router.push({ pathname: '/journey/[chain]', params: { chain: longestTrip.chain, autoplay: '1' } });
  // Screen gutter 16, page border 1 and page padding 16 on each side.
  const inner = Math.min(width, 520) - 66;
  const size = Math.floor((inner - GAP * (COLUMNS - 1)) / COLUMNS);
  // One clock for the page: a city's map cell is painted the moment its stamp lands.
  const clock = useSharedValue(reduced ? PAINT_END_MS : 0);

  useEffect(() => {
    if (!journeys) return;
    if (reduced) {
      clock.value = PAINT_END_MS;
      return;
    }
    clock.value = 0;
    clock.value = withTiming(PAINT_END_MS, { duration: PAINT_END_MS, easing: Easing.linear });
  }, [journeys, reduced, clock]);

  useEffect(() => {
    if (reduced || !stamps.length) return;
    const taps = stamps
      .slice(0, MAX_STAGGERED + 1)
      .map((_, i) => setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), stampDelay(i) + 60));
    return () => taps.forEach(clearTimeout);
  }, [stamps, reduced]);

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <ScreenHeader title={t.passportTitle} />
      {failed ? (
        <Text style={[styles.note, { color: palette.muted }]}>{t.mapError}</Text>
      ) : !journeys ? (
        <ActivityIndicator style={styles.center} color={palette.primary} />
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.cover}>
            <View style={styles.coverTitle}>
              <Confetti kind="clover" size={30} color={GILT} />
              <Text style={styles.coverText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {t.passportTitle}
              </Text>
            </View>
            <View style={styles.stats}>
              {(
                [
                  [stamps.length, t.passportCities],
                  [journeys.length, t.passportJourneys],
                  [longest, t.passportLongest],
                ] as const
              ).map(([value, label]) => {
                const content = (
                  <>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {label}
                    </Text>
                  </>
                );
                return label === t.passportLongest && longestTrip ? (
                  <Pressable
                    key={label}
                    onPress={openLongest}
                    accessibilityRole="button"
                    accessibilityHint={t.journeyReplay}
                    style={({ pressed }) => [styles.stat, styles.statTappable, pressed && styles.statPressed]}
                  >
                    {content}
                  </Pressable>
                ) : (
                  <View key={label} style={styles.stat}>
                    {content}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.page}>
            <PassportMap stamps={stamps} width={inner} clock={clock} />
            {stamps.length ? (
              <View style={styles.grid}>
                {stamps.map((stamp, i) => (
                  <PassportStamp key={stamp.city} stamp={stamp} size={size} delay={stampDelay(i)} onPress={() => setCity(stamp.city)} />
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>{t.passportEmpty}</Text>
            )}
          </View>
        </ScrollView>
      )}
      <Modal visible={city !== undefined} transparent animationType="fade" onRequestClose={() => setCity(undefined)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setCity(undefined)} accessibilityRole="button" accessibilityLabel={t.close}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={[styles.sheetCity, { color: cityInk }]}>{city}</Text>
            {clovers.length ? (
              <View style={styles.clovers}>
                {clovers.map((c, i) => (
                  <Image
                    key={c.key}
                    source={{ uri: c.uri }}
                    style={[styles.clover, { transform: [{ rotate: `${(i % 2 ? 1 : -1) * (3 + (hash(c.key) % 4))}deg` }] }]}
                    contentFit="cover"
                    accessibilityLabel={t.mapPhoto}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>{t.passportCityEmpty}</Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** A dot map of the world where each stamped city's cell fills with its stamp's ink as the stamp lands. */
function PassportMap({ stamps, width, clock }: { stamps: Stamp[]; width: number; clock: SharedValue<number> }) {
  const height = width / MAP_ASPECT;
  const { dots, radius, cells } = useMemo(() => {
    const placed = stamps.flatMap((s, i) => (s.la !== undefined && s.lo !== undefined ? [{ i, la: s.la, lo: s.lo }] : []));
    const v = fitView(placed, MAP_ASPECT);
    const land = landDots(v, MAP_ACROSS);
    const painted = paintCells(v, land.dots, land.step, placed).map((c) => ({ ...c, i: placed[c.i].i }));
    return { ...land, cells: painted };
  }, [stamps]);
  const r = radius * width;
  return (
    <View style={[styles.map, { width, height }]} accessible accessibilityLabel={t.passportStamps(stamps.length)}>
      <Svg width={width} height={height}>
        <G opacity={0.22}>
          {dots.map((d, k) => (
            <Circle key={k} cx={d.x * width} cy={d.y * height} r={r} fill={PAPER_INK} />
          ))}
        </G>
        {cells.map((c) => (
          <PaintedCell
            key={`${c.x},${c.y}`}
            x={c.x * width}
            y={c.y * height}
            r={r}
            ink={CARDS[stamps[c.i].card % CARDS.length].ink}
            at={stampDelay(c.i)}
            clock={clock}
          />
        ))}
      </Svg>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** One city's cell: a soft wash spreads around it and the dot itself swells in ink, timed to its stamp. */
function PaintedCell({
  x,
  y,
  r,
  ink,
  at,
  clock,
}: {
  x: number;
  y: number;
  r: number;
  ink: string;
  at: number;
  clock: SharedValue<number>;
}) {
  const wash = useAnimatedProps(() => ({
    r: interpolate(clock.value, [at, at + 260], [0, r * 3.2], Extrapolation.CLAMP),
    opacity: interpolate(clock.value, [at, at + 120, at + 260], [0, 0.35, 0.22], Extrapolation.CLAMP),
  }));
  const dot = useAnimatedProps(() => ({
    r: interpolate(clock.value, [at - 20, at + 80, at + 180], [0, r * 2.1, r * 1.6], Extrapolation.CLAMP),
  }));
  return (
    <G>
      <AnimatedCircle cx={x} cy={y} r={0} fill={ink} animatedProps={wash} />
      <AnimatedCircle cx={x} cy={y} r={0} fill={ink} animatedProps={dot} />
    </G>
  );
}

/** A slightly crooked ink stamp in the colour of the card that first brought luck there. */
function PassportStamp({ stamp, size, delay, onPress }: { stamp: Stamp; size: number; delay: number; onPress: () => void }) {
  const ink = CARDS[stamp.card % CARDS.length].ink;
  const h = hash(stamp.city);
  const tilt = (h % 17) - 8;
  // Three stamp shapes: round, rounded square, and a wide ticket.
  const shape = h % 3;
  const outer =
    shape === 0
      ? { width: size, height: size, borderRadius: size / 2 }
      : shape === 1
        ? { width: size * 0.92, height: size * 0.92, borderRadius: 16 }
        : { width: size, height: size * 0.74, borderRadius: 6 };
  const inner = { borderRadius: Math.max(outer.borderRadius - 4, 2) };
  return (
    <Animated.View entering={stampIn(delay)} style={[styles.slot, { width: size, height: size }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={stamp.visits > 1 ? `${stamp.city} ×${stamp.visits}` : stamp.city}
        style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={[styles.stamp, outer, { borderColor: ink, transform: [{ rotate: `${tilt}deg` }] }]}>
          <View style={[styles.stampInner, inner, { borderColor: ink }, shape === 0 && { paddingHorizontal: size * 0.12 }]}>
            <Text style={[styles.stampNo, { color: ink }]}>No.{stamp.n}</Text>
            {/* The short ticket fits one line; long names shrink instead of breaking out of it. */}
            <Text
              style={[styles.stampCity, { color: ink }]}
              numberOfLines={shape === 2 ? 1 : 2}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {stamp.city}
            </Text>
            <View style={styles.stampFoot}>
              <Confetti kind="clover" size={11} color={ink} />
              {stamp.visits > 1 ? <Text style={[styles.stampVisits, { color: ink }]}>×{stamp.visits}</Text> : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { marginTop: 48 },
  note: { fontFamily: FONT.body, fontSize: 15, textAlign: 'center', padding: 24 },
  body: { paddingHorizontal: 16, gap: 14, alignSelf: 'center', width: '100%', maxWidth: 520 },
  cover: { backgroundColor: COVER, borderRadius: 24, padding: 20, gap: 18 },
  coverTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coverText: { flex: 1, fontFamily: FONT.cute, fontSize: 22, color: GILT },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' },
  // The longest relay opens its trip: a gilt edge marks it as the one stat you can press.
  statTappable: { borderWidth: 1, borderColor: 'rgba(245,215,122,0.55)' },
  statPressed: { opacity: 0.7 },
  statValue: { fontFamily: FONT.cute, fontSize: 26, color: PAPER },
  statLabel: { fontFamily: FONT.body, fontSize: 12, color: PAPER, opacity: 0.8 },
  page: { backgroundColor: PAPER, borderRadius: 24, borderWidth: 1, borderColor: PAPER_EDGE, padding: 16, minHeight: 240 },
  map: { borderRadius: 16, backgroundColor: '#F6EED6', overflow: 'hidden', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23, textAlign: 'center', color: PAPER_INK, marginTop: 24 },
  slot: { alignItems: 'center', justifyContent: 'center' },
  stamp: { borderWidth: 2.5, padding: 3, opacity: 0.88 },
  stampInner: { flex: 1, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 6, gap: 1 },
  stampNo: { fontFamily: FONT.medium, fontSize: 10, letterSpacing: 1 },
  stampCity: { fontFamily: FONT.cute, fontSize: 15, lineHeight: 19, textAlign: 'center' },
  stampFoot: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stampVisits: { fontFamily: FONT.medium, fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: PAPER,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PAPER_EDGE,
    padding: 20,
    gap: 14,
  },
  sheetCity: { fontFamily: FONT.cute, fontSize: 22, textAlign: 'center' },
  clovers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  clover: { width: 96, height: 96, borderRadius: 10, borderWidth: 4, borderColor: '#fff' },
});
