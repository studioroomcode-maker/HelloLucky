import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { FONT, usePalette } from '@/constants/theme';
import { BADGES, badgeCounters, badgeText, earnedBadges } from '@/src/badges';
import { t } from '@/src/i18n';
import { useFinds, useSettings } from '@/src/services/findsStore';
import { BadgeMedal } from '@/src/ui/BadgeMedal';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

const COLUMNS = 3;

/** Width in Latin-letter units; CJK and emoji count double. */
const units = (text: string) => [...text].reduce((n, c) => n + (/[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]|\p{Extended_Pictographic}/u.test(c) ? 2 : 1), 0);

/** Long names (German compounds, 4-word French titles) shrink a little so a word never splits mid-way in a third of the screen. */
function titleSize(title: string) {
  const word = Math.max(...title.split(/[\s-]+/).map(units));
  const total = units(title);
  return word > 15 || total > 30 ? 10 : word > 12 || total > 24 ? 11.5 : 13;
}

export default function Badges() {
  const palette = usePalette();
  const finds = useFinds();
  const settings = useSettings();
  const [onlyEarned, setOnlyEarned] = useState(false);
  const earned = useMemo(() => earnedBadges(finds, badgeCounters(settings, t.fortunes.length)), [finds, settings]);
  // 500 badges: a virtualized grid, earned ones first in the "all" view so progress is visible.
  const list = useMemo(
    () =>
      onlyEarned
        ? BADGES.filter((b) => earned.has(b.id))
        : [...BADGES.filter((b) => earned.has(b.id)), ...BADGES.filter((b) => !earned.has(b.id))],
    [earned, onlyEarned],
  );

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <ScreenHeader title={t.badgesTitle} />
      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        initialNumToRender={24}
        windowSize={7}
        ListHeaderComponent={
          <>
            <Text style={[styles.count, { color: palette.muted }]}>{t.badgesCount(earned.size, BADGES.length)}</Text>
            <View style={[styles.segment, { backgroundColor: palette.surfaceAlt }]} accessibilityRole="tablist">
              {[
                { value: false, label: t.badgesAll },
                { value: true, label: t.badgesEarned },
              ].map(({ value, label }) => (
                <Pressable
                  key={label}
                  onPress={() => setOnlyEarned(value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: onlyEarned === value }}
                  style={[styles.segItem, onlyEarned === value && { backgroundColor: palette.surface }]}
                >
                  <Text style={[styles.segText, { color: onlyEarned === value ? palette.text : palette.muted }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        }
        renderItem={({ item: { id, hidden } }) => {
          const has = earned.has(id);
          const text = badgeText(t, id, has);
          return (
            <View
              style={[styles.badge, { backgroundColor: has ? palette.surface : palette.surfaceAlt, borderColor: palette.border }]}
              accessible
              accessibilityLabel={`${text.title}. ${has ? text.desc : t.badgeLocked}`}
            >
              <View style={[styles.medal, { backgroundColor: has ? 'transparent' : palette.border }]}>
                {has ? (
                  <BadgeMedal id={id} size={56} />
                ) : hidden ? (
                  <Text style={[styles.mystery, { color: palette.muted }]}>?</Text>
                ) : (
                  <Ionicons name="lock-closed" size={22} color={palette.muted} />
                )}
              </View>
              <Text
                style={[styles.title, { color: has ? palette.text : palette.muted, fontSize: titleSize(text.title), lineHeight: titleSize(text.title) + 4 }]}
                numberOfLines={2}
              >
                {text.title}
              </Text>
              {/* A still-hidden badge keeps its condition secret: just the "???" title. */}
              {has || !hidden ? (
                <Text style={[styles.desc, { color: palette.muted }]} numberOfLines={4}>
                  {text.desc}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { padding: 16, paddingBottom: 40, gap: 12 },
  count: { fontSize: 15, fontFamily: FONT.cute, marginBottom: 12, textAlign: 'center' },
  row: { gap: 12 },
  badge: {
    flex: 1,
    // A short last row keeps the same cell width instead of stretching.
    maxWidth: `${100 / COLUMNS - 2}%`,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  medal: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  mystery: { fontSize: 26, fontFamily: FONT.cute },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, fontFamily: FONT.cute },
  title: { fontSize: 13, lineHeight: 17, fontFamily: FONT.cute, textAlign: 'center' },
  desc: { fontFamily: FONT.body, fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
