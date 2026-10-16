import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, usePalette } from '@/constants/theme';
import { t } from '@/src/i18n';
import { letterMessage } from '@/src/letters';
import { Sticker } from '@/src/ui/art';
import type { Thanks } from '@/src/services/sharing';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

/** "Someone in Busan is grateful for your luck": a sticker that came back for a letter I sent. */
export function ThanksPopup({ thanks, onClose, onJourney }: { thanks?: Thanks; onClose: () => void; onJourney: () => void }) {
  const palette = usePalette();
  if (!thanks) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.title, { color: palette.primary }]}>{t.thanksNewsTitle}</Text>
          <View style={styles.sticker} accessibilityElementsHidden>
            <Sticker index={thanks.thanks_key} size={96} />
          </View>
          <Text style={[styles.body, { color: palette.text }]}>
            {thanks.thanks_city ? t.thanksFrom(thanks.thanks_city) : t.thanksFromSomewhere}
          </Text>
          <Text style={[styles.quote, { color: palette.muted }]}>
            “{letterMessage(t, thanks.message_key)}”
          </Text>
          <PrimaryButton icon="earth" label={t.seeJourney} onPress={onJourney} />
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={styles.close}>
            <Text style={[styles.closeText, { color: palette.muted }]}>{t.close}</Text>
          </Pressable>
        </View>
        <LuckBurst trigger={1} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 22, gap: 12, alignItems: 'stretch' },
  title: { fontSize: 20, fontFamily: FONT.cute, textAlign: 'center' },
  sticker: { alignItems: 'center' },
  body: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  quote: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  close: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
  closeText: { fontFamily: FONT.medium, fontSize: 15 },
});
