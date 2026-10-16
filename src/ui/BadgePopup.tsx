import { Modal, StyleSheet, Text, View } from 'react-native';

import { FONT, usePalette } from '@/constants/theme';
import { badgeText, type BadgeId } from '@/src/badges';
import { t } from '@/src/i18n';
import { BadgeMedal } from '@/src/ui/BadgeMedal';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

/** Celebrates a freshly earned badge. */
export function BadgePopup({ badge, onClose }: { badge?: BadgeId; onClose: () => void }) {
  const palette = usePalette();
  return (
    <Modal visible={!!badge} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {badge ? (
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <Text style={[styles.kicker, { color: palette.primary }]}>{t.newBadge}</Text>
            <BadgeMedal id={badge} size={96} />
            <Text style={[styles.title, { color: palette.text }]}>{badgeText(t, badge, true).title}</Text>
            <Text style={[styles.desc, { color: palette.muted }]}>{badgeText(t, badge, true).desc}</Text>
            <PrimaryButton label={t.yay} onPress={onClose} />
          </View>
        ) : null}
        <LuckBurst trigger={badge ? 1 : 0} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { width: '100%', maxWidth: 340, borderRadius: 28, padding: 24, alignItems: 'center', gap: 10 },
  kicker: { fontSize: 16, fontFamily: FONT.cute },
  title: { fontSize: 22, fontFamily: FONT.cute },
  desc: { fontFamily: FONT.body, fontSize: 14, textAlign: 'center', marginBottom: 6 },
});
