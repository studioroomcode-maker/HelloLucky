import { forwardRef, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { FONT } from '@/constants/theme';
import { ARROW, t } from '@/src/i18n';
import { arcControl, arcDegrees, fitView, landDots, project, quadLength, quadPoint } from '@/src/journeyMap';
import { flagEmoji, letterMessage, routeCities, type Hop } from '@/src/letters';
import { CardArt, Confetti } from '@/src/ui/art';
import { CARDS } from '@/src/ui/LuckCard';
import { ANIMAL_EMOJI, NICKNAME_COUNT } from '@/src/nicknames';

export const CARD_WIDTH = 340;
const PAD = 18;
const MAP_W = CARD_WIDTH - PAD * 2;
// The card is at least 4:5; stats and the stop list make long trips taller (about 2:3 for ten hops).
const MAP_H = MAP_W / 1.75;
const GOLD = '#F2B705';
const GREEN = '#3DAA4E';
const DOT = 8; // trail dot spacing: 1 dot + 7 gap

// Travel timeline in stop units: the first pin pops during LEAD, leg k flies over [k, k + FLY] and rests
// until k + 1, then the little card lands into the last pin during LAND.
const LEAD = 0.5;
const FLY = 0.8;
const LAND = 0.4;
// Short trips fly each stop in SHORT_MS; longer ones ease toward LONG_MS a stop, the whole trip capped at MAX_MS.
const SHORT_MS = 1400;
const LONG_MS = 2000;
const MAX_MS = 20000;

type Point = { x: number; y: number };
type Props = {
  route: Hop[];
  hops: number;
  cameHome: boolean;
  messageKey: number;
  cardKey: number;
  play?: number;
  /** ISO country code per route index, for the flag in front of each city. */
  countries?: Record<number, string>;
  /** My clover, on journeys I started from a find. */
  photo?: string;
};

function ease(f: number) {
  'worklet';
  return f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
}

/** How far along leg k the card is at progress p: 0 before it leaves, 1 once it has arrived. */
function legDone(p: number, k: number) {
  'worklet';
  return ease(Math.min(Math.max((p - k) / FLY, 0), 1));
}

/** When stop i's pin pops. */
const arrival = (i: number) => (i === 0 ? -LEAD * 0.7 : i - 1 + FLY);

/** Milliseconds per stop unit: unhurried for long trips (2 legs → SHORT_MS, 8+ → LONG_MS), never past MAX_MS in all. */
export function tripUnitMs(legs: number) {
  const unit = SHORT_MS + (LONG_MS - SHORT_MS) * Math.min(Math.max((legs - 2) / 6, 0), 1);
  return Math.min(unit, MAX_MS / (legs + LAND + LEAD));
}

/** How much of the route is flown `ms` into a trip: whole legs plus the eased part of the current one. */
export function tripDone(ms: number, legs: number) {
  const p = ms / tripUnitMs(legs) - LEAD;
  if (p <= 0 || !legs) return 0;
  const k = Math.min(Math.floor(p), legs - 1);
  return k + legDone(p, k);
}

/** The whole trip, landing included. */
export const tripMs = (legs: number) => tripUnitMs(legs) * (legs + LAND + LEAD);

/**
 * Shareable card (4:5, taller for long trips): where a chain of luck has been, on a dot map. Rendered at CARD_WIDTH and captured
 * (react-native-view-shot) at 1080 px wide for feeds and messengers.
 * Each new `play` flies a little luck card stop to stop, dotting the trail behind it. Without `play` (or with
 * reduce motion) the route is shown finished, as a capture needs.
 */
export const JourneyCard = forwardRef<View, Props>(function JourneyCard(
  { route, hops, cameHome, messageKey, cardKey, play, countries = {}, photo },
  ref,
) {
  const card = CARDS[cardKey % CARDS.length];
  const stops = route.filter((h): h is Required<Pick<Hop, 'la' | 'lo'>> & Hop => typeof h.la === 'number' && typeof h.lo === 'number');
  const view = fitView(
    stops.map((h) => ({ la: h.la, lo: h.lo })),
    MAP_W / MAP_H,
  );
  const { dots, radius } = landDots(view);
  const pts = stops.map((h) => {
    const p = project(view, { la: h.la, lo: h.lo });
    return { x: p.x * MAP_W, y: p.y * MAP_H };
  });
  const ctrls = pts.slice(1).map((b, i) => {
    const c = arcControl({ x: pts[i].x / MAP_W, y: pts[i].y / MAP_H }, { x: b.x / MAP_W, y: b.y / MAP_H });
    return { x: c.x * MAP_W, y: c.y * MAP_H };
  });
  const legs = ctrls.length;
  const end = pts.length ? legs + LAND : 0;
  const reduced = useReducedMotion();
  const still = play === undefined || reduced || !pts.length;
  const progress = useSharedValue(still ? end : -LEAD);

  useEffect(() => {
    cancelAnimation(progress);
    if (still) {
      progress.value = end;
      return;
    }
    const unit = tripUnitMs(legs);
    progress.value = -LEAD;
    progress.value = withTiming(end, { duration: unit * (end + LEAD), easing: Easing.linear });
    // A soft tap as each stop is stamped.
    const taps = Array.from({ length: legs }, (_, i) =>
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), unit * (arrival(i + 1) + LEAD)),
    );
    return () => taps.forEach(clearTimeout);
  }, [play, still, end, legs, progress]);

  const cities = routeCities(route);
  const headline = cameHome
    ? t.journeyCardHome(hops)
    : hops === 0
      ? t.journeyCardFirst
      : t.journeyCardTraveling(hops, new Set(cities.filter((c) => c !== '?')).size);
  // Bragging rights: places, countries and the distance flown (great circle, 111.195 km a degree).
  const km = Math.round(stops.slice(1).reduce((sum, h, i) => sum + arcDegrees(stops[i], h), 0) * 111.195);
  const nations = new Set(Object.values(countries)).size;
  const stats: [string, string][] = [[String(new Set(cities.filter((c) => c !== '?')).size), t.journeyStatCities]];
  if (nations) stats.push([String(nations), t.journeyStatCountries]);
  if (km) stats.push([km.toLocaleString(), 'km']);

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: card.bg }]}>
      <View pointerEvents="none" style={styles.watermark}>
        <Confetti kind="clover" size={180} color={card.ink} />
      </View>
      <View style={styles.header}>
        <Image source={require('@/assets/logo.png')} style={styles.logo} contentFit="contain" contentPosition="left" tintColor={card.ink} />
        <Text style={[styles.kicker, { color: card.ink }]}>{t.journeyTitle}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.headline, { color: card.ink }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
          {headline}
        </Text>
        {photo ? (
          <View style={styles.polaroid}>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
          </View>
        ) : null}
      </View>
      {legs ? (
        <View style={styles.stats}>
          {stats.map(([value, label], i) => (
            <View key={label} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: `${card.ink}22` }]}>
              <Text style={[styles.statValue, { color: card.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                {value}
              </Text>
              <Text style={[styles.statLabel, { color: card.ink }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.map}>
        <Svg width={MAP_W} height={MAP_H}>
          <G opacity={0.28}>
            {dots.map((d, i) => (
              <Circle key={i} cx={d.x * MAP_W} cy={d.y * MAP_H} r={radius * MAP_W} fill={card.ink} />
            ))}
          </G>
          {ctrls.map((c, i) => (
            <Leg key={`leg${i}`} index={i} a={pts[i]} c={c} b={pts[i + 1]} progress={progress} color={card.ink} />
          ))}
          {pts.map((p, i) => (
            <Pin key={`pin${i}`} index={i} point={p} end={i === 0 || i === pts.length - 1} progress={progress} />
          ))}
        </Svg>
        {legs ? (
          <Traveler pts={pts} ctrls={ctrls} progress={progress} cardKey={cardKey} riders={stops.slice(0, legs).map((h) => riderOf(h.n))} />
        ) : null}
      </View>

      {/* Every stop as 🇰🇷 Seoul → 🇯🇵 Tokyo → …, wrapping; a long trip makes the card taller. */}
      <View style={styles.route}>
        {route.map((hop, i) => (
          <View key={i} style={styles.stop}>
            <View style={styles.chip}>
              <Text style={[styles.city, { color: card.ink }]}>
                {countries[i] ? `${flagEmoji(countries[i])} ` : ''}
                {hop.c?.trim() || '?'}
              </Text>
            </View>
            {i < route.length - 1 ? <Text style={[styles.arrow, { color: card.ink }]}>{ARROW}</Text> : null}
          </View>
        ))}
      </View>
      <View style={styles.quoteBox}>
        <Text style={[styles.quote, { color: card.ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
          “{letterMessage(t, messageKey)}”
        </Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.ctaRow}>
          <Confetti kind="clover" size={13} />
          <Text style={[styles.cta, { color: card.ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {t.journeyCardCta}
          </Text>
        </View>
      </View>
    </View>
  );
});

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * One dotted leg that fills in behind the card. Its dash pattern is a run of dots longer than the leg followed
 * by a gap as long as the leg; the offset slides in whole dot steps, so the dots it reveals never crawl.
 */
function Leg({
  index,
  a,
  c,
  b,
  progress,
  color,
}: {
  index: number;
  a: Point;
  c: Point;
  b: Point;
  progress: SharedValue<number>;
  color: string;
}) {
  const length = quadLength(a, c, b);
  const run = Math.ceil(length / DOT) * DOT; // dots before the gap, at 0, DOT, …, run
  const dash = useMemo(() => {
    const d = Array.from({ length: run / DOT + 1 }, () => [1, DOT - 1]).flat();
    d[d.length - 1] += length;
    return d;
  }, [run, length]);
  const animated = useAnimatedProps(() => {
    const t = legDone(progress.value, index);
    // Before the card leaves, the whole leg sits in the gap; otherwise its first dot would show early.
    return { strokeDashoffset: t <= 0 ? run + DOT / 2 : run - Math.floor(quadLength(a, c, b, t) / DOT) * DOT };
  });
  return (
    <AnimatedPath
      d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`}
      stroke={color}
      strokeWidth={3}
      strokeDasharray={dash}
      strokeLinecap="round"
      fill="none"
      animatedProps={animated}
    />
  );
}

/** A numbered stop that pops in with a little overshoot when the card reaches it. */
function Pin({ index, point, end, progress }: { index: number; point: Point; end: boolean; progress: SharedValue<number> }) {
  const r = end ? 11 : 8;
  const at = arrival(index);
  const circle = useAnimatedProps(() => ({
    r: r * interpolate(progress.value, [at - 0.12, at, at + 0.12], [0, 1.3, 1], Extrapolation.CLAMP),
  }));
  const label = useAnimatedProps(() => ({ opacity: progress.value >= at ? 1 : 0 }));
  return (
    <G>
      <AnimatedCircle cx={point.x} cy={point.y} r={r} fill={end ? GOLD : GREEN} stroke="#fff" strokeWidth={2.5} animatedProps={circle} />
      <AnimatedG animatedProps={label}>
        <SvgText x={point.x} y={point.y + (end ? 4 : 3.5)} fontSize={end ? 11 : 9} fontWeight="bold" fill="#fff" textAnchor="middle">
          {index + 1}
        </SvgText>
      </AnimatedG>
    </G>
  );
}

const MINI_W = 30;
const MINI_H = 24;

/** The little luck card itself: flies each leg with a lean and a lift, then lands into the last pin. */
function Traveler({
  pts,
  ctrls,
  progress,
  cardKey,
  riders,
}: {
  pts: Point[];
  ctrls: Point[];
  progress: SharedValue<number>;
  cardKey: number;
  riders: string[];
}) {
  const legs = ctrls.length;
  const card = CARDS[cardKey % CARDS.length];
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const k = Math.min(Math.max(Math.floor(p), 0), legs - 1);
    const f = legDone(p, k);
    const pos = quadPoint(pts[k], ctrls[k], pts[k + 1], f);
    const lift = Math.sin(Math.PI * f);
    const size =
      p < 0
        ? interpolate(p, [-LEAD * 0.6, 0], [0, 1], Extrapolation.CLAMP)
        : interpolate(p, [legs, legs + LAND], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: size > 0.01 ? 1 : 0,
      transform: [
        { translateX: pos.x - MINI_W / 2 },
        { translateY: pos.y - MINI_H / 2 },
        { rotate: `${(pts[k + 1].x >= pts[k].x ? 1 : -1) * 14 * lift}deg` },
        { scale: size * (1 + 0.25 * lift) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.mini, riders.some(Boolean) ? styles.bare : { backgroundColor: card.bg }, style]}>
      {riders.some(Boolean) ? (
        riders.map((emoji, i) => <Rider key={i} index={i} legs={legs} emoji={emoji || '🍀'} progress={progress} />)
      ) : (
        <CardArt card={cardKey} size={18} ink={card.ink} />
      )}
    </Animated.View>
  );
}

/** The animal of whoever sent a leg ('' when the hop carries no name, as on older trips). */
const riderOf = (n: number | undefined) => (Number.isInteger(n) && n! >= 0 && n! < NICKNAME_COUNT ? ANIMAL_EMOJI[n! % 50] : '');

/** The sender's animal for leg `index`, shown only while the card flies that leg. */
function Rider({ index, legs, emoji, progress }: { index: number; legs: number; emoji: string; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(Math.floor(progress.value), 0), legs - 1) === index ? 1 : 0 }));
  return <Animated.Text style={[styles.rider, style]}>{emoji}</Animated.Text>;
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, minHeight: (CARD_WIDTH * 5) / 4, borderRadius: 28, padding: PAD, gap: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 84, height: 30 },
  kicker: { fontFamily: FONT.medium, fontSize: 13, opacity: 0.8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { flex: 1, fontFamily: FONT.cute, fontSize: 21, lineHeight: 28 },
  // My clover as a little polaroid pinned to the card.
  polaroid: {
    backgroundColor: '#fff',
    padding: 4,
    paddingBottom: 12,
    borderRadius: 4,
    transform: [{ rotate: '5deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  photo: { width: 66, height: 66, borderRadius: 2 },
  watermark: { position: 'absolute', right: -40, bottom: -36, opacity: 0.07, transform: [{ rotate: '-18deg' }] },
  stats: { flexDirection: 'row', borderRadius: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.6)' },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statValue: { fontFamily: FONT.cute, fontSize: 20, lineHeight: 26 },
  statLabel: { fontFamily: FONT.body, fontSize: 11, opacity: 0.75 },
  map: { width: MAP_W, height: MAP_H, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  bare: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  rider: { position: 'absolute', fontSize: 20, lineHeight: 24, textAlign: 'center', width: MINI_W },
  // The flying card is positioned by transform from the map's top-left corner.
  mini: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MINI_W,
    height: MINI_H,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  route: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 5 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 3 },
  chip: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  city: { fontFamily: FONT.medium, fontSize: 12 },
  arrow: { fontFamily: FONT.body, fontSize: 11, opacity: 0.6 },
  quoteBox: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.75)' },
  quote: { fontFamily: FONT.cute, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // The call to action keeps one line; the address gives way.
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  cta: { fontFamily: FONT.medium, fontSize: 12, opacity: 0.8 },
});
