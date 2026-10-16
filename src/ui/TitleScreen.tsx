import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { t } from '@/src/i18n';

const HOLD_MS = 1400;
const FADE_MS = 400;

/**
 * Full-screen title art shown once per launch over the app, after the native splash.
 * `onShown` fires when the art is on screen (hide the native splash then, so nothing flashes);
 * `onDone` when it has faded out. Tap to skip.
 */
export function TitleScreen({ onShown, onDone }: { onShown: () => void; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    const timer = setTimeout(finish, HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per launch
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <Pressable style={styles.fill} onPress={finish} accessibilityRole="image" accessibilityLabel={t.appName}>
        <Image
          source={require('@/assets/title.png')}
          style={styles.fill}
          contentFit="cover"
          onDisplay={onShown}
          onError={onShown}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#23BCFC' },
});
