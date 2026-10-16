import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Confetti } from '@/src/ui/art';

const COUNT = 28;

/** Special-day shower: little clovers drift down the whole screen once (about 4 s). Skipped with reduced motion. */
export function LuckRain({ active, kind = 'clover', onDone }: { active: boolean; kind?: 'clover' | 'star'; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const fall = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState<boolean>();
  const drops = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: Math.random() * width,
        delay: Math.random() * 0.45,
        sway: (Math.random() - 0.5) * 60,
        spin: `${(Math.random() - 0.5) * 360}deg`,
        size: 18 + Math.random() * 16,
      })),
    [width],
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced, () => setReduced(false));
  }, []);

  useEffect(() => {
    if (!active || reduced === undefined) return;
    if (reduced) {
      onDone();
      return;
    }
    fall.setValue(0);
    Animated.timing(fall, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true }).start(() => onDone());
  }, [active, reduced, fall, onDone]);

  if (!active || reduced !== false) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drops.map((d, i) => {
        // Each drop starts a little later and falls through the full height in the rest of the time.
        const t = fall.interpolate({ inputRange: [0, d.delay, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: d.x,
              top: -40,
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height + 80] }) },
                { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, d.sway, 0] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', d.spin] }) },
              ],
            }}
          >
            <Confetti kind={kind} size={d.size} color={i % 4 === 0 ? '#F5C431' : '#3DAA4E'} />
          </Animated.View>
        );
      })}
    </View>
  );
}
