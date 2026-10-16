import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, FONT } from '@/constants/theme';
import { lang, t } from '@/src/i18n';
import { BADGES, badgeCounters, earnedBadges, type BadgeId } from '@/src/badges';
import { potStage } from '@/src/pot';
import { bumpCounters, updateSettings, useFinds, useSettings } from '@/src/services/findsStore';
import { myPlace } from '@/src/letters';
import { checkMailbox, luckToday, myEcho, myThanks, openLetter, sharingAvailable, type LuckyLetter, type Thanks } from '@/src/services/sharing';
import { dayStamp, memoryOfToday, specialDay } from '@/src/warm';
import { loadDetector } from '@/src/services/detector/model';
import { LuckRain } from '@/src/ui/LuckRain';
import { Flower } from '@/src/ui/art';
import { BadgePopup } from '@/src/ui/BadgePopup';
import { LetterPopup } from '@/src/ui/LetterPopup';
import { LuckPot } from '@/src/ui/LuckPot';
import { PrimaryButton } from '@/src/ui/PrimaryButton';
import { ThanksPopup } from '@/src/ui/ThanksPopup';

const COLUMNS = 3;
const FLOWERS = ['#F48FB1', '#FFB74D', '#B39DDB', '#F06292'];
// Around an 84 dp pot: a ring of spots, filled in order as thank-yous arrive.
const FLOWER_SPOTS = [
  { left: -6, top: 58 }, { left: 66, top: 60 }, { left: 30, top: 70 }, { left: -10, top: 30 },
  { left: 74, top: 30 }, { left: 10, top: 74 }, { left: 52, top: 74 }, { left: -4, top: 6 },
  { left: 70, top: 4 }, { left: 18, top: -6 }, { left: 48, top: -6 }, { left: 86, top: 50 },
];
const GAP = 4;

export default function Home() {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const finds = useFinds();
  const settings = useSettings();
  const earned = useMemo(() => earnedBadges(finds, badgeCounters(settings, t.fortunes.length)), [finds, settings]);
  const [newBadge, setNewBadge] = useState<BadgeId>();
  const [mail, setMail] = useState<LuckyLetter[]>([]);
  const [thanks, setThanks] = useState<Thanks[]>([]);
  const place = useMemo(() => myPlace(finds), [finds]);
  const [echo, setEcho] = useState(0);
  const [world, setWorld] = useState(0);
  const today = dayStamp(new Date());
  const special = specialDay(new Date());
  const memory = useMemo(() => memoryOfToday(finds, new Date()), [finds]);

  // Warm the detector while the user is on home, so the scanner starts finding at once.
  useEffect(() => {
    loadDetector().catch(() => {});
  }, []);
  const lastMailCheck = useRef(0);

  // Lucky letters from strangers: check on arrival at home, at most once a minute.
  useFocusEffect(
    useCallback(() => {
      if (!sharingAvailable || !settings.onboarded || Date.now() - lastMailCheck.current < 60_000) return;
      lastMailCheck.current = Date.now();
      checkMailbox(lang)
        .then(setMail)
        .then(myThanks)
        .then((news) => {
          setThanks(news);
          if (news.length) bumpCounters({ thanksGot: news.length }).catch(() => {});
        })
        .catch((error) => console.warn('home: mailbox check failed', error));
      myEcho().then(setEcho, () => {});
      luckToday().then(setWorld, () => {});
    }, [settings.onboarded]),
  );

  const finishLetter = (letter: LuckyLetter) => {
    openLetter(letter.id).catch(() => {});
    bumpCounters({ receivedLuck: 1, homecomings: letter.homecoming ? 1 : 0 }).catch(() => {});
    setMail((list) => list.filter((l) => l.id !== letter.id));
  };

  // Celebrate the first badge earned since the last visit.
  useFocusEffect(
    useCallback(() => {
      if (!settings.onboarded) return;
      const fresh = [...earned].find((id) => !settings.seenBadges.includes(id));
      if (fresh) setNewBadge(fresh);
    }, [earned, settings.onboarded, settings.seenBadges]),
  );

  // One popup per visit: everything earned so far counts as seen; the badge screen holds the rest.
  const closeBadge = () => {
    const fresh = [...earned].filter((id) => !settings.seenBadges.includes(id));
    if (fresh.length) updateSettings({ seenBadges: [...settings.seenBadges, ...fresh] }).catch(() => {});
    setNewBadge(undefined);
  };

  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  const tile = (width - 32 - GAP * (COLUMNS - 1)) / COLUMNS;
  const pot = potStage(finds.length);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
            contentPosition="left"
            tintColor={palette.primary}
            accessibilityRole="header"
            accessibilityLabel={t.appName}
          />
        </View>
        {sharingAvailable ? (
          <Pressable
            onPress={() => router.push('/letters')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.mailboxTitle}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="mail-outline" size={22} color={palette.text} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/map')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.mapTitle}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="map-outline" size={22} color={palette.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t.settings}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="settings-outline" size={22} color={palette.text} />
        </Pressable>
      </View>

      {/* Below the icon row so it keeps one line in every language. */}
      <Text style={[styles.subtitle, { color: palette.muted }]}>{t.homeCount(finds.length)}</Text>

      <Pressable
        onPress={() => router.push('/badges')}
        accessibilityRole="button"
        accessibilityLabel={`${t.potTitle}, ${t.potStages[pot.stage]}. ${t.badgesCount(earned.size, BADGES.length)}`}
        style={({ pressed }) => [styles.garden, { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.potWrap}>
          <LuckPot stage={pot.stage} size={84} />
          {/* Thank-you garden: every sticker someone sent back blooms around the pot (up to 12). */}
          {FLOWER_SPOTS.slice(0, Math.min(settings.thanksGot, FLOWER_SPOTS.length)).map((spot, i) => (
            <View key={i} style={[styles.flower, spot]} accessibilityElementsHidden>
              <Flower size={18} color={FLOWERS[i % FLOWERS.length]} />
            </View>
          ))}
        </View>
        <View style={styles.gardenText}>
          <Text style={[styles.potTitle, { color: palette.text }]}>
            {t.potTitle} · {t.potStages[pot.stage]}
          </Text>
          <Text style={[styles.potNext, { color: palette.muted }]}>{pot.toNext ? t.potNext(pot.toNext) : t.potMax}</Text>
          {settings.thanksGot ? <Text style={[styles.warm, { color: palette.muted }]}>{t.gardenLabel(settings.thanksGot)}</Text> : null}
          {echo ? <Text style={[styles.warm, { color: palette.primary }]}>{t.echoLine(echo)}</Text> : null}
          {/* Only once the world is busy enough that the number feels like company. */}
          {world >= 10 ? <Text style={[styles.warm, { color: palette.muted }]}>{t.worldToday(world)}</Text> : null}
          <View style={[styles.badgeChip, { backgroundColor: palette.surface }]}>
            <Ionicons name="ribbon" size={14} color={palette.gold} />
            <Text style={[styles.badgeChipText, { color: palette.text }]}>{t.badgesCount(earned.size, BADGES.length)}</Text>
            <Ionicons name="chevron-forward" size={14} color={palette.muted} />
          </View>
        </View>
      </Pressable>

      {special ? (
        <View style={[styles.note, { backgroundColor: palette.surfaceAlt }]}>
          <Text style={[styles.noteTitle, { color: palette.text }]}>{t.specialDay[special]}</Text>
          <Text style={[styles.noteBody, { color: palette.muted }]}>{t.specialCardNote}</Text>
        </View>
      ) : null}
      {memory && settings.memoryClosed !== today ? (
        <Pressable
          onPress={() => router.push({ pathname: '/find/[id]', params: { id: memory.find.id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.note, styles.memory, { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.85 : 1 }]}
        >
          <Image source={{ uri: memory.find.photoUri }} style={styles.memoryPhoto} contentFit="cover" />
          <View style={styles.memoryText}>
            <Text style={[styles.noteTitle, { color: palette.text }]}>{t.memoryTitle(memory.years)}</Text>
            <Text style={[styles.noteBody, { color: palette.muted }]}>{t.memoryBody(memory.find.place)}</Text>
          </View>
          <Pressable
            onPress={() => updateSettings({ memoryClosed: today }).catch(() => {})}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.close}
          >
            <Ionicons name="close" size={20} color={palette.muted} />
          </Pressable>
        </Pressable>
      ) : null}

      {finds.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: palette.surfaceAlt }]}>
            <Ionicons name="leaf" size={56} color={palette.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>{t.homeEmptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: palette.muted }]}>{t.homeEmptyBody}</Text>
        </View>
      ) : (
        <FlatList
          data={finds}
          keyExtractor={(item) => item.id}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/find/[id]', params: { id: item.id } })}
              accessibilityRole="imagebutton"
              accessibilityLabel={new Date(item.createdAt).toLocaleDateString()}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Image
                source={{ uri: item.photoUri }}
                style={[styles.tile, { width: tile, height: tile, backgroundColor: palette.surfaceAlt }]}
                contentFit="cover"
                recyclingKey={item.id}
                transition={150}
              />
              {item.aiDetected ? (
                <View style={[styles.aiBadge, { backgroundColor: palette.primary }]}>
                  <Ionicons name="sparkles" size={11} color={palette.onPrimary} />
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <PrimaryButton icon="scan" label={t.findButton} onPress={() => router.push('/scan')} />
      </View>
      <LuckRain
        active={!!special && settings.rainShown !== today}
        kind={special === 'newYear' ? 'star' : 'clover'}
        onDone={() => updateSettings({ rainShown: today }).catch(() => {})}
      />
      {/* One popup at a time: letters, then thank-yous, then badges. */}
      <BadgePopup badge={mail.length || thanks.length ? undefined : newBadge} onClose={closeBadge} />
      <ThanksPopup
        thanks={mail.length ? undefined : thanks[0]}
        onClose={() => setThanks((list) => list.slice(1))}
        onJourney={() => {
          setThanks([]);
          router.push({ pathname: '/letters', params: { tab: 'journeys' } });
        }}
      />
      <LetterPopup
        letter={mail[0]}
        place={place}
        onDone={finishLetter}
        onRelayed={() => bumpCounters({ sentLuck: 1, relayed: 1 }).catch(() => {})}
        onThanked={() => bumpCounters({ thanksGiven: 1 }).catch(() => {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerText: { flex: 1 },
  logo: { width: 92, height: 72 },
  subtitle: { fontFamily: FONT.body, fontSize: 15, marginTop: -6, marginBottom: 14, paddingHorizontal: 20 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 120 },
  emptyIcon: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontFamily: FONT.cute, textAlign: 'center' },
  emptyBody: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  tile: { borderRadius: 10 },
  garden: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 14, borderRadius: 24, padding: 12 },
  gardenText: { flex: 1, gap: 4 },
  potTitle: { fontSize: 17, fontFamily: FONT.cute },
  potWrap: { width: 84, height: 84 },
  flower: { position: 'absolute' },
  warm: { fontFamily: FONT.medium, fontSize: 12 },
  note: { marginHorizontal: 16, marginBottom: 12, borderRadius: 20, padding: 14, gap: 4 },
  noteTitle: { fontFamily: FONT.cute, fontSize: 15 },
  noteBody: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  memory: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memoryPhoto: { width: 52, height: 52, borderRadius: 12 },
  memoryText: { flex: 1, gap: 2 },
  potNext: { fontFamily: FONT.body, fontSize: 13 },
  badgeChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2 },
  badgeChipText: { fontSize: 13, fontFamily: FONT.cute },
  aiBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { position: 'absolute', left: 20, right: 20, bottom: 0 },
});
