import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { badgeLook, type Glyph } from '@/src/badges';
import { LEAF } from '@/src/ui/leaf';

const W = '#FFFFFF';

function starPath(cx: number, cy: number, outer: number, inner: number, points = 5) {
  const pts = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join('L')}Z`;
}

const leaves = (n: 3 | 4, s = 30, y = 50) => (
  <G transform={`translate(50 ${y}) scale(${s})`}>
    {(n === 4 ? [45, 135, 225, 315] : [0, 120, 240]).map((deg) => (
      <Path key={deg} d={LEAF} fill={W} transform={`rotate(${deg}) translate(0 -0.06)`} />
    ))}
  </G>
);
const line = { stroke: W, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

/** White glyphs drawn in a 100 × 100 box, centred on the medal. */
const GLYPH: Record<Glyph, ReactNode> = {
  clover: leaves(4),
  sprout: (
    <>
      <Path d="M50 74V46" {...line} />
      <Ellipse cx={39} cy={44} rx={12} ry={7} fill={W} transform="rotate(-25 39 44)" />
      <Ellipse cx={61} cy={40} rx={12} ry={7} fill={W} transform="rotate(25 61 40)" />
    </>
  ),
  crown: <Path d="M26 66L22 36L38 48L50 30L62 48L78 36L74 66Z" fill={W} strokeLinejoin="round" stroke={W} strokeWidth={4} />,
  flame: <Path d="M50 24C58 38 70 44 68 60C66 72 58 78 50 78C40 78 32 70 32 60C32 50 40 46 42 36C46 42 48 46 50 48C52 40 52 32 50 24Z" fill={W} />,
  calendar: (
    <>
      <Rect x={28} y={32} width={44} height={40} rx={7} fill={W} />
      <Path d="M38 26V36M62 26V36" {...line} />
      <Rect x={28} y={32} width={44} height={10} rx={5} fill="rgba(0,0,0,0.18)" />
    </>
  ),
  robot: (
    <>
      <Path d="M50 24V32" {...line} />
      <Circle cx={50} cy={22} r={4} fill={W} />
      <Rect x={28} y={32} width={44} height={36} rx={11} fill={W} />
      <Circle cx={41} cy={49} r={5} fill="rgba(0,0,0,0.3)" />
      <Circle cx={59} cy={49} r={5} fill="rgba(0,0,0,0.3)" />
    </>
  ),
  eye: (
    <>
      <Path d="M22 50Q50 24 78 50Q50 76 22 50Z" fill={W} />
      <Circle cx={50} cy={50} r={9} fill="rgba(0,0,0,0.3)" />
    </>
  ),
  pin: (
    <>
      <Path d="M50 78C40 64 32 56 32 45A18 18 0 0 1 68 45C68 56 60 64 50 78Z" fill={W} />
      <Circle cx={50} cy={45} r={7} fill="rgba(0,0,0,0.25)" />
    </>
  ),
  globe: (
    <>
      <Circle cx={50} cy={50} r={24} fill={W} />
      <Ellipse cx={50} cy={50} rx={11} ry={24} stroke="rgba(0,0,0,0.32)" strokeWidth={4} fill="none" />
      <Path d="M27 50H73" stroke="rgba(0,0,0,0.32)" strokeWidth={4} />
    </>
  ),
  pencil: (
    <G transform="rotate(45 50 50)">
      <Rect x={43} y={22} width={14} height={42} rx={3} fill={W} />
      <Path d="M43 64L50 78L57 64Z" fill={W} />
    </G>
  ),
  book: (
    <>
      <Path d="M50 34C42 28 32 28 24 31V70C32 67 42 67 50 73Z" fill={W} />
      <Path d="M50 34C58 28 68 28 76 31V70C68 67 58 67 50 73Z" fill={W} opacity={0.85} />
    </>
  ),
  letter: (
    <>
      <Rect x={24} y={32} width={52} height={36} rx={6} fill={W} />
      <Path d="M26 35L50 53L74 35" stroke="rgba(0,0,0,0.22)" strokeWidth={4} fill="none" strokeLinejoin="round" />
    </>
  ),
  gift: (
    <>
      <Rect x={28} y={44} width={44} height={30} rx={4} fill={W} />
      <Rect x={24} y={36} width={52} height={11} rx={3} fill={W} />
      <Path d="M50 36V74" stroke="rgba(0,0,0,0.22)" strokeWidth={5} />
      <Path d="M50 36C44 24 34 28 40 36M50 36C56 24 66 28 60 36" {...line} />
    </>
  ),
  sparkle: (
    <>
      <Path d={starPath(46, 52, 24, 7, 4)} fill={W} />
      <Path d={starPath(70, 30, 9, 3, 4)} fill={W} />
    </>
  ),
  trophy: (
    <>
      <Path d="M34 28H66V42C66 54 58 60 50 60C42 60 34 54 34 42Z" fill={W} />
      <Path d="M34 34H26C26 44 30 48 36 48M66 34H74C74 44 70 48 64 48" {...line} />
      <Rect x={46} y={58} width={8} height={10} fill={W} />
      <Rect x={36} y={68} width={28} height={7} rx={3} fill={W} />
    </>
  ),
  clock: (
    <>
      <Circle cx={50} cy={50} r={25} fill={W} />
      <Path d="M50 50V35M50 50L60 57" stroke="rgba(0,0,0,0.3)" strokeWidth={5} strokeLinecap="round" />
    </>
  ),
  cake: (
    <>
      <Rect x={28} y={50} width={44} height={24} rx={5} fill={W} />
      <Path d="M28 58Q36 64 44 58T60 58T72 58" stroke="rgba(0,0,0,0.18)" strokeWidth={4} fill="none" />
      <Rect x={47} y={34} width={6} height={14} rx={2} fill={W} />
      <Ellipse cx={50} cy={28} rx={4} ry={6} fill={W} />
    </>
  ),
  arrows: <Path d="M26 34L42 50L26 66M48 34L64 50L48 66M62 34L78 50L62 66" {...line} strokeWidth={7} />,
  heart: <Path d="M50 76C26 60 18 46 27 35C35 26 45 28 50 37C55 28 65 26 73 35C82 46 74 60 50 76Z" fill={W} />,
  house: (
    <>
      <Path d="M24 50L50 28L76 50" {...line} strokeWidth={7} />
      <Path d="M32 48V74H68V48L50 33Z" fill={W} />
      <Rect x={45} y={58} width={10} height={16} rx={2} fill="rgba(0,0,0,0.22)" />
    </>
  ),
  blossom: (
    <>
      {[0, 72, 144, 216, 288].map((deg) => (
        <Ellipse key={deg} cx={50} cy={33} rx={10} ry={14} fill={W} transform={`rotate(${deg} 50 50)`} />
      ))}
      <Circle cx={50} cy={50} r={7} fill="rgba(0,0,0,0.2)" />
    </>
  ),
  sun: (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <Rect key={i} x={47} y={18} width={6} height={12} rx={3} fill={W} transform={`rotate(${i * 45} 50 50)`} />
      ))}
      <Circle cx={50} cy={50} r={16} fill={W} />
    </>
  ),
  leaf: (
    <>
      <Path d="M50 76C30 66 26 44 34 26C52 30 72 42 66 62C62 70 56 74 50 76Z" fill={W} />
      <Path d="M50 76C48 60 44 46 36 32" stroke="rgba(0,0,0,0.2)" strokeWidth={4} fill="none" strokeLinecap="round" />
    </>
  ),
  snowflake: (
    <>
      {[0, 60, 120].map((deg) => (
        <Path key={deg} d="M50 24V76M42 30L50 38L58 30M42 70L50 62L58 70" {...line} transform={`rotate(${deg} 50 50)`} />
      ))}
    </>
  ),
  star: <Path d={starPath(50, 52, 27, 12)} fill={W} stroke={W} strokeWidth={4} strokeLinejoin="round" />,
  bolt: <Path d="M56 22L30 54H48L42 78L70 44H52Z" fill={W} strokeLinejoin="round" stroke={W} strokeWidth={3} />,
  return: (
    <>
      <Path d="M66 64A18 18 0 1 1 64 38" {...line} strokeWidth={7} />
      <Path d="M58 28L68 38L56 44" {...line} strokeWidth={7} />
    </>
  ),
};

/** An earned badge: its kind's glyph on a medal coloured by tier, with a soft rim. */
export function BadgeMedal({ id, size = 56 }: { id: string; size?: number }) {
  const { glyph, color } = badgeLook(id);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={48} fill={color} />
      <Circle cx={50} cy={50} r={42} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={3} />
      {GLYPH[glyph]}
    </Svg>
  );
}
