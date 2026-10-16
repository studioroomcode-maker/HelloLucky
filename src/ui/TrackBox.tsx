import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { CameraColors, FONT } from '@/constants/theme';
import { DETECTOR } from '@/src/config/detector';

type Rect = { left: number; top: number; width: number; height: number };

// Glide to each new detection over one detector interval, so the box moves continuously between updates.
const GLIDE = { duration: 1000 / DETECTOR.targetFps, easing: Easing.out(Easing.quad) };

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
    left: left.value + motion.value.x,
    top: top.value + motion.value.y,
    width: width.value,
    height: height.value,
  }));
  const color = stable ? CameraColors.lock : CameraColors.candidate;
  return (
    <Animated.View style={[styles.box, { borderColor: color }, !stable && styles.candidate, style]}>
      <Animated.View style={[styles.label, { backgroundColor: color }]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 3, borderRadius: 12 },
  candidate: { borderStyle: 'dashed' },
  label: {
    position: 'absolute',
    top: -26,
    left: -3,
    // Boxes can be narrower than the text; keep the label on one line.
    minWidth: 64,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelText: { color: '#10210F', fontSize: 13, fontFamily: FONT.cute },
});
