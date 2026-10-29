import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { FONT, usePalette } from '@/constants/theme';
import { t } from '@/src/i18n';
import { Confetti } from '@/src/ui/art';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { LuckRain } from '@/src/ui/LuckRain';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

/** The big moment right after a clover is photographed: a shower of clovers, a huge title and the find's fortune. */
export function FoundPopup({ visible, fortune, onClose }: { visible: boolean; fortune: string; onClose: () => void }) {
  const palette = usePalette();
  const [rain, setRain] = useState(true);

  useEffect(() => {
    if (visible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Confetti kind="clover" size={96} />
          <Text style={[styles.title, { color: palette.primary }]} accessibilityRole="header">
            {t.newFindTitle}
          </Text>
          <Text style={[styles.cheer, { color: palette.text }]}>{fortune}</Text>
          <PrimaryButton label={t.yay} onPress={onClose} />
        </View>
        <LuckBurst trigger={visible ? 1 : 0} scale={1.4} />
        <LuckRain active={visible && rain} onDone={() => setRain(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, borderRadius: 32, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 14 },
  title: { fontSize: 34, lineHeight: 42, fontFamily: FONT.cute, textAlign: 'center', letterSpacing: -0.5 },
  cheer: { fontSize: 21, lineHeight: 30, fontFamily: FONT.cute, textAlign: 'center', marginBottom: 8 },
});
