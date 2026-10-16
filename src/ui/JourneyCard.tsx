import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { FONT } from '@/constants/theme';
import { SHARE_URL } from '@/src/config/links';
import { t } from '@/src/i18n';
import { arcControl, fitView, landDots, project, shortRoute } from '@/src/journeyMap';
import { letterMessage, routeCities, type Hop } from '@/src/letters';
import { Confetti } from '@/src/ui/art';
import { CARDS } from '@/src/ui/LuckCard';

export const CARD_WIDTH = 340;
const PAD = 18;
const MAP_W = CARD_WIDTH - PAD * 2;
// Map + 2-line headline + 1-line route + 2-line quote + footer fit the 4:5 card in every language.
const MAP_H = MAP_W / 1.75;
const GOLD = '#F2B705';
const GREEN = '#3DAA4E';

type Props = { route: Hop[]; hops: number; cameHome: boolean; messageKey: number; cardKey: number };

/**
 * Shareable 4:5 card: where a chain of luck has been, on a dot map. Rendered at CARD_WIDTH and captured
 * (react-native-view-shot) at 1080 px wide for feeds and messengers.
 */
export const JourneyCard = forwardRef<View, Props>(function JourneyCard({ route, hops, cameHome, messageKey, cardKey }, ref) {
  const card = CARDS[cardKey % CARDS.length];
  const stops = route.filter((h): h is Required<Pick<Hop, 'la' | 'lo'>> & Hop => typeof h.la === 'number' && typeof h.lo === 'number');
  const view = fitView(stops.map((h) => ({ la: h.la, lo: h.lo })), MAP_W / MAP_H);
  const { dots, radius } = landDots(view);
  const pts = stops.map((h) => {
    const p = project(view, { la: h.la, lo: h.lo });
    return { x: p.x * MAP_W, y: p.y * MAP_H };
  });
  const cities = routeCities(route);
  const headline = cameHome ? t.journeyCardHome(hops) : hops === 0 ? t.journeyCardFirst : t.journeyCardTraveling(hops, new Set(cities.filter((c) => c !== '?')).size);
  const host = SHARE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: card.bg }]}>
      <View style={styles.header}>
        <Image source={require('@/assets/logo.png')} style={styles.logo} contentFit="contain" contentPosition="left" tintColor={card.ink} />
        <Text style={[styles.kicker, { color: card.ink }]}>{t.journeyTitle}</Text>
      </View>
      <Text style={[styles.headline, { color: card.ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
        {headline}
      </Text>

      <View style={styles.map}>
        <Svg width={MAP_W} height={MAP_H}>
          <G opacity={0.28}>
            {dots.map((d, i) => (
              <Circle key={i} cx={d.x * MAP_W} cy={d.y * MAP_H} r={radius * MAP_W} fill={card.ink} />
            ))}
          </G>
          {pts.slice(1).map((b, i) => {
            const a = pts[i];
            const c = arcControl({ x: a.x / MAP_W, y: a.y / MAP_H }, { x: b.x / MAP_W, y: b.y / MAP_H });
            return (
              <Path
                key={`leg${i}`}
                d={`M${a.x},${a.y} Q${c.x * MAP_W},${c.y * MAP_H} ${b.x},${b.y}`}
                stroke={card.ink}
                strokeWidth={3}
                strokeDasharray="1 7"
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
          {pts.map((p, i) => {
            const end = i === 0 || i === pts.length - 1;
            return (
              <G key={`pin${i}`}>
                <Circle cx={p.x} cy={p.y} r={end ? 11 : 8} fill={end ? GOLD : GREEN} stroke="#fff" strokeWidth={2.5} />
                <SvgText x={p.x} y={p.y + (end ? 4 : 3.5)} fontSize={end ? 11 : 9} fontWeight="bold" fill="#fff" textAnchor="middle">
                  {i + 1}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {cities.length ? (
        <Text style={[styles.route, { color: card.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {shortRoute(cities).join(' → ')}
        </Text>
      ) : null}
      <Text style={[styles.quote, { color: card.ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        “{letterMessage(t, messageKey)}”
      </Text>
      <View style={styles.footer}>
        <View style={styles.ctaRow}>
          <Confetti kind="clover" size={16} />
          <Text style={[styles.cta, { color: card.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {t.journeyCardCta}
          </Text>
        </View>
        <Text style={[styles.host, { color: card.ink }]} numberOfLines={1}>
          {host}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, aspectRatio: 4 / 5, borderRadius: 28, padding: PAD, gap: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 84, height: 30 },
  kicker: { fontFamily: FONT.medium, fontSize: 13, opacity: 0.8 },
  headline: { fontFamily: FONT.cute, fontSize: 21, lineHeight: 28 },
  map: { width: MAP_W, height: MAP_H, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  route: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 19 },
  quote: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18, opacity: 0.85 },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // The call to action keeps one line; the address gives way.
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0, maxWidth: '70%' },
  cta: { fontFamily: FONT.cute, fontSize: 14 },
  host: { fontFamily: FONT.body, fontSize: 10, opacity: 0.7, flexShrink: 1 },
});
