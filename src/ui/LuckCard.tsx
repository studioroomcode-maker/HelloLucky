import { StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/theme';
import { CardArt } from '@/src/ui/art';

/** Card designs for lucky letters; the index travels as card_key (0–9, checked by the server). 8–9 are special-day cards. */
export const CARDS = [
  { bg: '#E6F7E1', ink: '#1F6B33' },
  { bg: '#FFF4C7', ink: '#7A5A00' },
  { bg: '#FFE3EA', ink: '#8C2F4A' },
  { bg: '#E2F0FF', ink: '#24518A' },
  { bg: '#FFE6D9', ink: '#8A3A1C' },
  { bg: '#EEE6FF', ink: '#4B3291' },
  { bg: '#DDF5EF', ink: '#1C6658' },
  { bg: '#FFEEDB', ink: '#86501A' },
  { bg: '#E2F6C9', ink: '#145A24' },
  { bg: '#FFE6BF', ink: '#8A4300' },
] as const;

/** Cards a random letter can get; the rest are reserved for special days (src/warm.ts). */
export const EVERYDAY_CARDS = 8;

export function LuckCard({ card, message, footer }: { card: number; message: string; footer?: string }) {
  const c = CARDS[card % CARDS.length];
  return (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      <CardArt card={card} size={64} />
      <Text style={[styles.message, { color: c.ink }]}>{message}</Text>
      {footer ? <Text style={[styles.footer, { color: c.ink }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  message: { fontSize: 19, lineHeight: 27, textAlign: 'center', fontFamily: FONT.cute },
  footer: { fontFamily: FONT.body, fontSize: 13, opacity: 0.75, textAlign: 'center' },
});
