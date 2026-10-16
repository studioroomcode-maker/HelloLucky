import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FONT, usePalette, type Palette } from '@/constants/theme';
import { t } from '@/src/i18n';
import { deleteAllFinds, updateSettings, useFinds, useSettings } from '@/src/services/findsStore';
import { unshareAll } from '@/src/services/sharing';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

// License notices for the bundled detector; kept in English like the license texts themselves.
const MODEL_NOTICE =
  'Detector based on YOLOX © Megvii (Apache-2.0). Extra training photos: iNaturalist contributors (CC0 / CC BY / CC BY-SA).';

function Row({
  palette,
  icon,
  label,
  onPress,
  danger,
  right,
}: {
  palette: Palette;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const color = danger ? palette.danger : palette.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={danger ? palette.danger : palette.muted} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={palette.muted} /> : null)}
    </Pressable>
  );
}

const THEMES = [
  { mode: 'light', label: t.themeLight },
  { mode: 'dark', label: t.themeDark },
  { mode: 'system', label: t.themeSystem },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const settings = useSettings();
  const finds = useFinds();
  const card = [styles.card, { backgroundColor: palette.surface, borderColor: palette.border }];

  const confirmDeleteAll = () => {
    Alert.alert(t.deleteAll, t.deleteAllConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          // Best effort: offline deletes still wipe the device; pins can be removed later from here.
          await unshareAll(finds).catch((error) => console.warn('settings: unshareAll failed', error));
          await deleteAllFinds();
        },
      },
    ]);
  };

  const confirmRemoveShares = () => {
    Alert.alert(t.deleteMyShares, t.deleteMySharesConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.unshare,
        style: 'destructive',
        onPress: () => unshareAll(finds).catch(() => Alert.alert(t.shareError)),
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title={t.settings} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={card}>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={22} color={palette.muted} />
            <View style={styles.flex}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>{t.saveLocation}</Text>
              <Text style={[styles.rowHint, { color: palette.muted }]}>{t.saveLocationBody}</Text>
            </View>
            <Switch
              value={settings.saveLocation}
              onValueChange={(value) => updateSettings({ saveLocation: value })}
              trackColor={{ true: palette.primary, false: palette.border }}
              thumbColor={palette.surface}
              accessibilityLabel={t.saveLocation}
            />
          </View>
        </View>

        <View style={[card, styles.themeCard]}>
          <View style={styles.themeHead}>
            <Ionicons name="contrast-outline" size={22} color={palette.muted} />
            <Text style={[styles.rowLabel, { color: palette.text }]}>{t.themeTitle}</Text>
          </View>
          <View style={[styles.segment, { backgroundColor: palette.surfaceAlt }]} accessibilityRole="radiogroup">
            {THEMES.map(({ mode, label }) => {
              const selected = settings.theme === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => updateSettings({ theme: mode })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.segItem, selected && { backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.segText, { color: selected ? palette.text : palette.muted }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={card}>
          <Row palette={palette} icon="help-circle-outline" label={t.howItWorks} onPress={() => router.push('/onboarding')} />
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <Row palette={palette} icon="shield-checkmark-outline" label={t.privacy} onPress={() => router.push('/privacy')} />
        </View>

        {finds.length > 0 ? (
          <View style={card}>
            {finds.some((find) => find.sharedId) ? (
              <>
                <Row palette={palette} icon="earth-outline" label={t.deleteMyShares} onPress={confirmRemoveShares} danger />
                <View style={[styles.divider, { backgroundColor: palette.border }]} />
              </>
            ) : null}
            <Row palette={palette} icon="trash-outline" label={t.deleteAll} onPress={confirmDeleteAll} danger />
          </View>
        ) : null}

        <Text style={[styles.version, { color: palette.muted }]}>
          {t.appName} · {t.version} {Constants.expoConfig?.version ?? ''}
        </Text>
        <Text style={[styles.credit, { color: palette.muted }]}>{t.modelCredit}</Text>
        <Text style={[styles.credit, { color: palette.muted }]}>{MODEL_NOTICE}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56, paddingVertical: 12 },
  rowLabel: { fontFamily: FONT.medium, flex: 1, fontSize: 16 },
  rowHint: { fontFamily: FONT.body, fontSize: 13, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  themeCard: { padding: 16, gap: 12 },
  themeHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, fontFamily: FONT.cute },
  version: { fontFamily: FONT.body, textAlign: 'center', fontSize: 13, marginTop: 8 },
  credit: { fontFamily: FONT.body, textAlign: 'center', fontSize: 11, lineHeight: 16, paddingHorizontal: 12 },
});
