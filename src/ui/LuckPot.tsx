import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { LEAF } from './leaf';

const GREEN = '#3DAA4E';
const DARK = '#23803A';

function Clover({ x, y, s, leaves = 4, color = GREEN }: { x: number; y: number; s: number; leaves?: 3 | 4; color?: string }) {
  const angles = leaves === 4 ? [45, 135, 225, 315] : [0, 120, 240];
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      {angles.map((deg) => (
        <Path key={deg} d={LEAF} fill={color} transform={`rotate(${deg}) translate(0 -0.06)`} />
      ))}
    </G>
  );
}

function Stem({ from, to, bend = 0 }: { from: [number, number]; to: [number, number]; bend?: number }) {
  const midX = (from[0] + to[0]) / 2 + bend;
  const midY = (from[1] + to[1]) / 2;
  return <Path d={`M${from[0]} ${from[1]}Q${midX} ${midY} ${to[0]} ${to[1]}`} stroke={DARK} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
}

/** A smiling terracotta pot whose plant grows with `stage` (0 seed … 5 bloom, see src/pot.ts). */
export function LuckPot({ stage, size = 96 }: { stage: number; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {stage === 1 ? (
        <>
          <Stem from={[50, 58]} to={[50, 44]} />
          <Ellipse cx={44} cy={44} rx={7} ry={4} fill={GREEN} transform="rotate(-25 44 44)" />
          <Ellipse cx={56} cy={42} rx={7} ry={4} fill={GREEN} transform="rotate(25 56 42)" />
        </>
      ) : null}
      {stage === 2 ? (
        <>
          <Stem from={[50, 58]} to={[50, 36]} />
          <Clover x={50} y={34} s={13} leaves={3} />
        </>
      ) : null}
      {stage === 3 ? (
        <>
          <Stem from={[50, 58]} to={[50, 30]} bend={-4} />
          <Clover x={50} y={28} s={16} />
        </>
      ) : null}
      {stage >= 4 ? (
        <>
          <Stem from={[44, 58]} to={[30, 40]} bend={-4} />
          <Clover x={29} y={38} s={11} leaves={3} />
          <Stem from={[56, 58]} to={[71, 42]} bend={4} />
          <Clover x={72} y={40} s={11} leaves={3} />
          <Stem from={[50, 58]} to={[50, 26]} />
          <Clover x={50} y={24} s={16} />
        </>
      ) : null}
      {stage >= 5 ? (
        <>
          <Circle cx={36} cy={22} r={5} fill="#FFFFFF" stroke="#F3D7E4" strokeWidth={1.5} />
          <Circle cx={66} cy={25} r={5} fill="#FFFFFF" stroke="#F3D7E4" strokeWidth={1.5} />
          <Path d="M20 18l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#FFC93C" />
          <Path d="M82 14l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z" fill="#FFC93C" />
        </>
      ) : null}
      {/* Pot with a little face */}
      <Ellipse cx={50} cy={59} rx={27} ry={4.5} fill="#6B4A2F" />
      {stage === 0 ? <Ellipse cx={50} cy={57} rx={3} ry={2} fill="#C8A26B" /> : null}
      <Path d="M27 64H73L67.5 91.5Q66.8 95 63 95H37Q33.2 95 32.5 91.5Z" fill="#E8835A" />
      <Rect x={23} y={57} width={54} height={10} rx={5} fill="#F2996F" />
      <Circle cx={42.5} cy={77} r={2.2} fill="#5A2E1A" />
      <Circle cx={57.5} cy={77} r={2.2} fill="#5A2E1A" />
      <Path d="M45.5 82.5Q50 86.5 54.5 82.5" stroke="#5A2E1A" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Ellipse cx={37} cy={82} rx={3.2} ry={2} fill="#F7A8A0" opacity={0.8} />
      <Ellipse cx={63} cy={82} rx={3.2} ry={2} fill="#F7A8A0" opacity={0.8} />
    </Svg>
  );
}
