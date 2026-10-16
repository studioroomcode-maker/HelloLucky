import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { usePalette, FONT } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, icon, loading, variant = 'primary', disabled }: Props) {
  const palette = usePalette();
  const primary = variant === 'primary';
  const fg = primary ? palette.onPrimary : palette.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: primary ? palette.primary : palette.surfaceAlt, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 56,
    paddingVertical: 10,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  label: { fontSize: 17, fontFamily: FONT.cute, flexShrink: 1, textAlign: 'center' },
});
