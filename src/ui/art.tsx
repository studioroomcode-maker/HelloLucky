/**
 * Hand-drawn style art for cards, stickers and celebrations, in the same flat style as the luck pot
 * (src/ui/LuckPot.tsx) and the app icon's leaf curve, instead of system emoji.
 * Everything is drawn in a 100 × 100 box.
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { LEAF } from './leaf';

const GREEN = '#3DAA4E';
const DARK = '#23803A';
const GOLD = '#F5C431';
const PINK = '#F48FB1';
const CREAM = '#FFFDF6';

function starPath(cx: number, cy: number, outer: number, inner: number, points = 5) {
  const pts = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join('L')}Z`;
}
const HEART = 'M50 84C22 64 12 46 23 33C33 22 45 25 50 36C55 25 67 22 77 33C88 46 78 64 50 84Z';

function Leaves({ x, y, s, n = 4, color = GREEN }: { x: number; y: number; s: number; n?: 3 | 4; color?: string }) {
  const angles = n === 4 ? [45, 135, 225, 315] : [0, 120, 240];
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      {angles.map((deg) => (
        <Path key={deg} d={LEAF} fill={color} transform={`rotate(${deg}) translate(0 -0.06)`} />
      ))}
    </G>
  );
}

function CloverArt({ n = 4, color = GREEN }: { n?: 3 | 4; color?: string }) {
  return (
    <>
      <Path d="M50 52Q54 70 62 86" stroke={DARK} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <Leaves x={50} y={46} s={40} n={n} color={color} />
    </>
  );
}

/** Card motifs, by card_key (src/ui/LuckCard.tsx CARDS). */
const CARD_ART: ((ink: string) => ReactNode)[] = [
  () => <CloverArt />,
  () => (
    <>
      <Path d={starPath(50, 52, 38, 17)} fill={GOLD} strokeLinejoin="round" stroke={GOLD} strokeWidth={6} />
      <Circle cx={42} cy={50} r={3.2} fill="#7A5A00" />
      <Circle cx={58} cy={50} r={3.2} fill="#7A5A00" />
      <Path d="M44 60Q50 65 56 60" stroke="#7A5A00" strokeWidth={3} fill="none" strokeLinecap="round" />
    </>
  ),
  () => (
    <>
      {[0, 72, 144, 216, 288].map((deg) => (
        <Ellipse key={deg} cx={50} cy={30} rx={15} ry={20} fill={PINK} transform={`rotate(${deg} 50 50)`} />
      ))}
      <Circle cx={50} cy={50} r={11} fill={GOLD} />
    </>
  ),
  () => (
    <>
      {['#F06292', '#FFB74D', '#FFE082', '#81C784', '#64B5F6'].map((c, i) => (
        <Path key={c} d={`M${16 + i * 6} 72A${34 - i * 6} ${34 - i * 6} 0 0 1 ${84 - i * 6} 72`} stroke={c} strokeWidth={6.5} fill="none" strokeLinecap="round" />
      ))}
      <Circle cx={20} cy={72} r={9} fill="#fff" />
      <Circle cx={30} cy={75} r={7} fill="#fff" />
      <Circle cx={80} cy={72} r={9} fill="#fff" />
      <Circle cx={70} cy={75} r={7} fill="#fff" />
    </>
  ),
  () => (
    <>
      <Circle cx={50} cy={30} r={12} fill="#2B2B2B" />
      <Circle cx={50} cy={57} r={28} fill="#E8473F" />
      <Path d="M50 30V85" stroke="#2B2B2B" strokeWidth={3} />
      {[
        [38, 48], [62, 48], [36, 64], [64, 64], [44, 76], [56, 76],
      ].map(([x, y]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={4.5} fill="#2B2B2B" />
      ))}
      <Circle cx={45} cy={27} r={2.2} fill="#fff" />
      <Circle cx={55} cy={27} r={2.2} fill="#fff" />
    </>
  ),
  () => (
    <>
      <Ellipse cx={33} cy={40} rx={18} ry={16} fill="#9C83D9" transform="rotate(-20 33 40)" />
      <Ellipse cx={67} cy={40} rx={18} ry={16} fill="#9C83D9" transform="rotate(20 67 40)" />
      <Ellipse cx={36} cy={64} rx={12} ry={11} fill="#B9A6E8" />
      <Ellipse cx={64} cy={64} rx={12} ry={11} fill="#B9A6E8" />
      <Rect x={47} y={32} width={6} height={42} rx={3} fill="#4B3291" />
      <Path d="M48 33Q42 20 36 18M52 33Q58 20 64 18" stroke="#4B3291" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>
  ),
  () => <CloverArt n={3} color="#43A88A" />,
  () => (
    <>
      <Path d="M50 74Q46 82 52 90" stroke="#86501A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Ellipse cx={50} cy={42} rx={24} ry={29} fill="#FF8A50" />
      <Path d="M45 71L55 71L50 76Z" fill="#E86F33" />
      <Ellipse cx={41} cy={31} rx={6} ry={9} fill="#FFC4A3" transform="rotate(20 41 31)" />
    </>
  ),
  () => (
    <>
      <CloverArt />
      <Path d={starPath(80, 20, 9, 3, 4)} fill={GOLD} />
      <Path d={starPath(20, 30, 6, 2, 4)} fill={GOLD} />
      <Path d={starPath(82, 62, 5, 1.8, 4)} fill={GOLD} />
    </>
  ),
  () => (
    <>
      {[-60, -30, 0, 30, 60].map((deg) => (
        <Rect key={deg} x={48} y={14} width={4} height={14} rx={2} fill="#FFB347" transform={`rotate(${deg} 50 64)`} />
      ))}
      <Path d="M22 64A28 28 0 0 1 78 64Z" fill="#FF9F43" />
      <Rect x={14} y={64} width={72} height={5} rx={2.5} fill="#8A4300" />
      <Path d="M24 76H76M34 84H66" stroke="#8A4300" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
    </>
  ),
];

export function CardArt({ card, size = 64, ink = DARK }: { card: number; size?: number; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {CARD_ART[card % CARD_ART.length](ink)}
    </Svg>
  );
}

/** Thank-you stickers, by thanks_key (0–5, checked by the server). */
const STICKER_ART: ReactNode[] = [
  <Path key="heart" d={HEART} fill="#F06292" />,
  <G key="clover">
    <Leaves x={50} y={52} s={42} />
  </G>,
  <G key="smile">
    <Circle cx={50} cy={50} r={32} fill={GOLD} />
    <Circle cx={39} cy={44} r={4} fill="#5A3E00" />
    <Circle cx={61} cy={44} r={4} fill="#5A3E00" />
    <Path d="M37 57Q50 70 63 57" stroke="#5A3E00" strokeWidth={4} fill="none" strokeLinecap="round" />
    <Circle cx={31} cy={56} r={5} fill="#F7A6A6" opacity={0.8} />
    <Circle cx={69} cy={56} r={5} fill="#F7A6A6" opacity={0.8} />
  </G>,
  <Path key="star" d={starPath(50, 53, 36, 16)} fill={GOLD} stroke={GOLD} strokeWidth={6} strokeLinejoin="round" />,
  <G key="sun">
    {Array.from({ length: 8 }, (_, i) => (
      <Rect key={i} x={47} y={10} width={6} height={14} rx={3} fill="#FFB347" transform={`rotate(${i * 45} 50 50)`} />
    ))}
    <Circle cx={50} cy={50} r={22} fill="#FF9F43" />
  </G>,
  <G key="flower">
    {[0, 72, 144, 216, 288].map((deg) => (
      <Ellipse key={deg} cx={50} cy={30} rx={14} ry={19} fill={PINK} transform={`rotate(${deg} 50 50)`} />
    ))}
    <Circle cx={50} cy={50} r={10} fill={GOLD} />
  </G>,
];
export const STICKER_COUNT = STICKER_ART.length;

export function Sticker({ index, size = 40 }: { index: number; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {STICKER_ART[index % STICKER_ART.length]}
    </Svg>
  );
}

/** Sealed letter; homecoming letters wear a gold star seal. */
export function Envelope({ size = 110, homecoming = false }: { size?: number; homecoming?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={10} y={24} width={80} height={56} rx={9} fill={CREAM} stroke="#E6D9B8" strokeWidth={2.5} />
      <Path d="M12 30L50 58L88 30" stroke="#E6D9B8" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      <Path d="M12 78L40 52M88 78L60 52" stroke="#EFE5CB" strokeWidth={2.5} strokeLinecap="round" />
      {homecoming ? (
        <Path d={starPath(50, 58, 13, 6)} fill={GOLD} stroke={GOLD} strokeWidth={3} strokeLinejoin="round" />
      ) : (
        <G transform="translate(37 44) scale(0.26)">
          <Path d={HEART} fill="#E8473F" />
        </G>
      )}
    </Svg>
  );
}

/** A small flower for the thank-you garden. */
export function Flower({ size = 16, color = PINK }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {[0, 72, 144, 216, 288].map((deg) => (
        <Ellipse key={deg} cx={50} cy={28} rx={16} ry={22} fill={color} transform={`rotate(${deg} 50 50)`} />
      ))}
      <Circle cx={50} cy={50} r={13} fill={GOLD} />
    </Svg>
  );
}

/** Confetti piece for bursts and the special-day shower. */
export function Confetti({ kind, size = 24, color = GREEN }: { kind: 'clover' | 'star'; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {kind === 'star' ? <Path d={starPath(50, 52, 42, 18)} fill={GOLD} /> : <Leaves x={50} y={50} s={46} color={color} />}
    </Svg>
  );
}
