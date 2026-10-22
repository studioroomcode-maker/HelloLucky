import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, FONT } from '@/constants/theme';
import { CHEVRON_BACK, t } from '@/src/i18n';

export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  // Opened straight from a link or notification there is nothing behind the screen: back goes home instead.
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // The phone's back button too, which would otherwise close the app from such a screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      router.replace('/');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={back}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t.close}
        style={styles.back}
      >
        <Ionicons name={CHEVRON_BACK} size={26} color={palette.text} />
      </Pressable>
      <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {title}
      </Text>
      <View style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: FONT.cute },
});
