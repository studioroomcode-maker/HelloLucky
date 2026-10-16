import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Confetti } from '@/src/ui/art';

const COUNT = 14;

/** A pop of little clovers from the centre of the parent. Re-fires whenever `trigger` changes (0 = idle). */
export function LuckBurst({ trigger }: { trigger: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 110 + Math.random() * 90;
        return {
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance - 30,
          spin: `${(Math.random() - 0.5) * 540}deg`,
          size: 20 + Math.random() * 14,
          gold: Math.random() < 0.25,
        };
      }),
    // New random spread for every burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger],
  );

  useEffect(() => {
    if (!trigger) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [trigger, progress]);

  if (!trigger) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.center}>
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                // Rise then sink a little, like confetti.
                { translateY: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, p.dy, p.dy + 40] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] }) },
                { scale: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.15, 0.9] }) },
              ],
            }}
          >
            <Confetti kind="clover" size={p.size} color={p.gold ? '#F5C431' : '#3DAA4E'} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
