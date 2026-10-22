import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { CameraColors, FONT } from '@/constants/theme';
import { DETECTOR } from '@/src/config/detector';

type Rect = { left: number; top: number; width: number; height: number };

// Glide to each new detection over one detector interval, so the box moves continuously between updates.
const GLIDE = { duration: 1000 / DETECTOR.targetFps, easing: Easing.out(Easing.quad) };
// The frame sits this much of the clover's size outside it on every side, so it frames rather than clips the leaves.
const PAD = 0.18;
const CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

/**
 * A tracked clover on the live preview. `rect` is pinned to the scene (gyro motion removed); the box is drawn at
 * rect + current motion on the UI thread, so it follows the clover between detector frames.
 */
export function TrackBox({
  rect,
  motion,
  stable,
  label,
}: {
  rect: Rect;
  motion: SharedValue<{ x: number; y: number }>;
  stable: boolean;
  label: string;
}) {
  const left = useSharedValue(rect.left);
  const top = useSharedValue(rect.top);
  const width = useSharedValue(rect.width);
  const height = useSharedValue(rect.height);

  useEffect(() => {
    left.value = withTiming(rect.left, GLIDE);
    top.value = withTiming(rect.top, GLIDE);
    width.value = withTiming(rect.width, GLIDE);
    height.value = withTiming(rect.height, GLIDE);
  }, [rect.left, rect.top, rect.width, rect.height, left, top, width, height]);

  const style = useAnimatedStyle(() => ({
    left: left.value - width.value * PAD + motion.value.x,
    top: top.value - height.value * PAD + motion.value.y,
    width: width.value * (1 + 2 * PAD),
    height: height.value * (1 + 2 * PAD),
  }));
  const color = stable ? CameraColors.lock : CameraColors.candidate;
  // Only the four rounded corners, see-through, like the viewfinder on the title art.
  return (
    <Animated.View style={[styles.box, style]}>
      {CORNERS.map((corner) => (
        <Animated.View key={corner} style={[styles.corner, styles[corner], { borderColor: color }, !stable && styles.candidate]} />
      ))}
      <Animated.View style={[styles.label, { backgroundColor: color }]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Four white corner brackets around a clover found on a photo, drawn like the app icon's viewfinder: short rounded
 * arms with round ends, over a faint dark line so they read on bright grass too. Same breathing room as on the preview.
 */
export function CornerFrame({ rect }: { rect: Rect }) {
  const width = rect.width * (1 + 2 * PAD);
  const height = rect.height * (1 + 2 * PAD);
  const stroke = 3;
  const arm = Math.max(12, Math.min(width, height) * 0.22);
  const bend = arm * 0.45;
  const i = stroke; // keep the round caps and the shadow line inside the view
  const [l, t, r, b] = [i, i, width - i, height - i];
  const d = [
    `M${l},${t + arm} L${l},${t + bend} Q${l},${t} ${l + bend},${t} L${l + arm},${t}`,
    `M${r - arm},${t} L${r - bend},${t} Q${r},${t} ${r},${t + bend} L${r},${t + arm}`,
    `M${r},${b - arm} L${r},${b - bend} Q${r},${b} ${r - bend},${b} L${r - arm},${b}`,
    `M${l + arm},${b} L${l + bend},${b} Q${l},${b} ${l},${b - bend} L${l},${b - arm}`,
  ].join(' ');
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={[styles.box, { left: rect.left - rect.width * PAD, top: rect.top - rect.height * PAD }]}
    >
      <Path d={d} stroke="rgba(0,0,0,0.28)" strokeWidth={stroke + 2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  corner: { position: 'absolute', width: '26%', height: '26%', opacity: 0.8 },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  candidate: { opacity: 0.55 },
  label: {
    position: 'absolute',
    top: -26,
    left: 0,
    // Boxes can be narrower than the text; keep the label on one line.
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelText: { color: '#10210F', fontSize: 13, fontFamily: FONT.cute },
});
