import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, FONT } from '@/constants/theme';
import { lang, t } from '@/src/i18n';
import { POLICY_DATE, privacy } from '@/src/privacyText';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

export default function Privacy() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <ScreenHeader title={t.privacy} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* The policy is maintained in Korean and English; other languages read the English text. */}
        {privacy[lang === 'ko' ? 'ko' : 'en'].map(([title, body]) => (
          <View key={title} style={styles.section}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            <Text style={[styles.body, { color: palette.muted }]} selectable>
              {body}
            </Text>
          </View>
        ))}
        <Text style={[styles.date, { color: palette.muted }]}>{POLICY_DATE}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  section: { gap: 6 },
  title: { fontSize: 17, fontFamily: FONT.cute },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23 },
  date: { fontFamily: FONT.body, fontSize: 13 },
});
