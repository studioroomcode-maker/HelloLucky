import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, FONT } from '@/constants/theme';
import { t } from '@/src/i18n';
import { updateSettings } from '@/src/services/findsStore';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

const PAGES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'scan-outline', title: t.onb1Title, body: t.onb1Body },
  { icon: 'sparkles-outline', title: t.onb2Title, body: t.onb2Body },
  { icon: 'images-outline', title: t.onb3Title, body: t.onb3Body },
];

export default function Onboarding() {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const finish = async () => {
    await updateSettings({ onboarded: true });
    // Reopened from Settings → just go back; first launch → replace so Back can't return here.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        {!last ? (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.skip, { color: palette.muted }]}>{t.skip}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {PAGES.map((item) => (
          <View key={item.title} style={[styles.page, { width }]}>
            <View style={[styles.iconWrap, { backgroundColor: palette.surfaceAlt }]}>
              <Ionicons name={item.icon} size={72} color={palette.primary} />
            </View>
            <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
              {item.title}
            </Text>
            <Text style={[styles.body, { color: palette.muted }]}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PAGES.map((item, index) => (
          <View
            key={item.title}
            style={[
              styles.dot,
              { backgroundColor: index === page ? palette.primary : palette.border },
              index === page && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={last ? t.start : t.next}
          onPress={() => {
            if (last) {
              finish();
            } else {
              scroller.current?.scrollTo({ x: width * (page + 1), animated: true });
              setPage(page + 1);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { height: 48, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 24 },
  skip: { fontFamily: FONT.medium, fontSize: 16 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: { fontSize: 26, fontFamily: FONT.cute, textAlign: 'center', letterSpacing: -0.4 },
  body: { fontFamily: FONT.body, fontSize: 16, lineHeight: 25, textAlign: 'center', marginTop: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 24 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  footer: { paddingHorizontal: 20 },
});
