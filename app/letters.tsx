import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, usePalette } from '@/constants/theme';
import { ARROW, CHEVRON_FORWARD, formatDate, t } from '@/src/i18n';
import { letterMessage, myPlace, passportStamps, routeCities } from '@/src/letters';
import { bumpCounters, useFinds } from '@/src/services/findsStore';
import { letterClover, myJourneys, myLetters, sendLuckyLetter, type Journey, type KeptLetter } from '@/src/services/sharing';
import { CardArt } from '@/src/ui/art';
import { CARDS } from '@/src/ui/LuckCard';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { ScreenHeader } from '@/src/ui/ScreenHeader';

type Tab = 'received' | 'journeys';

// Same cover as the passport screen (app/passport.tsx).
const COVER = '#1F7A36';
const GILT = '#F5D77A';

/** Mailbox: cheers that reached me (keepsakes, relay from here) and how far the luck I sent has traveled. */
export default function Letters() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const finds = useFinds();
  // The received letter whose art last popped, and a counter that re-fires it.
  const [pop, setPop] = useState({ letter: '', n: 0 });
  const [tab, setTab] = useState<Tab>(params.tab === 'journeys' ? 'journeys' : 'received');
  const [letters, setLetters] = useState<KeptLetter[]>();
  const [journeys, setJourneys] = useState<Journey[]>();
  const [failed, setFailed] = useState(false);
  const [relaying, setRelaying] = useState<string>();

  useFocusEffect(
    useCallback(() => {
      setFailed(false);
      Promise.all([myLetters(), myJourneys()])
        .then(([l, j]) => {
          setLetters(l);
          setJourneys(j);
        })
        .catch((error) => {
          console.warn('letters: load failed', error);
          setFailed(true);
        });
    }, []),
  );

  const relay = async (item: KeptLetter) => {
    setRelaying(item.letter);
    try {
      await sendLuckyLetter(item.message_key, item.card_key, myPlace(finds), item.letter);
      bumpCounters({ sentLuck: 1, relayed: 1 }).catch(() => {});
      setLetters((list) => list?.map((l) => (l.letter === item.letter ? { ...l, relayed: true } : l)));
      Alert.alert(t.relaySent);
    } catch (error) {
      const message = String((error as Error)?.message);
      Alert.alert(/rate_limit/.test(message) ? t.strangerRateLimit : /already_relayed/.test(message) ? t.relayDone : t.shareError);
    } finally {
      setRelaying(undefined);
    }
  };

  const loading = !failed && (letters === undefined || journeys === undefined);
  const data = tab === 'received' ? letters ?? [] : journeys ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <ScreenHeader title={t.mailboxTitle} />
      <View style={[styles.segment, { backgroundColor: palette.surfaceAlt }]} accessibilityRole="tablist">
        {(
          [
            ['received', t.mailboxReceived],
            ['journeys', t.mailboxJourneys],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setTab(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            style={[styles.segItem, tab === value && { backgroundColor: palette.surface }]}
          >
            <Text style={[styles.segText, { color: tab === value ? palette.text : palette.muted }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} color={palette.primary} />
      ) : failed ? (
        <Text style={[styles.empty, { color: palette.muted }]}>{t.mapError}</Text>
      ) : (
        <FlatList<KeptLetter | Journey>
          data={data}
          keyExtractor={(item) => ('letter' in item ? item.letter : item.chain)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            tab === 'journeys' && journeys?.length ? (
              <Pressable
                onPress={() => router.push('/passport')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.passport, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Ionicons name="book" size={26} color={GILT} />
                <View style={styles.rowText}>
                  <Text style={styles.passportTitle}>{t.passportTitle}</Text>
                  <Text style={styles.passportMeta}>{t.passportStamps(passportStamps(journeys).length)}</Text>
                </View>
                <Ionicons name={CHEVRON_FORWARD} size={20} color={GILT} />
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: palette.muted }]}>
              {tab === 'received' ? t.mailboxEmpty : t.journeysEmpty}
            </Text>
          }
          renderItem={({ item }) => {
            const card = CARDS[item.card_key % CARDS.length];
            const cities = routeCities(item.route ?? []);
            if ('letter' in item) {
              const clover = letterClover(item, finds[0]?.cloverUri);
              return (
                <Pressable
                  onPress={() => {
                    setPop((p) => ({ letter: item.letter, n: p.n + 1 }));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  style={[styles.row, { backgroundColor: card.bg }]}
                >
                  <PoppingArt card={item.card_key} trigger={pop.letter === item.letter ? pop.n : 0} />
                  <View style={styles.rowText}>
                    <Text style={[styles.message, { color: card.ink }]}>{letterMessage(t, item.message_key)}</Text>
                    <View>
                      <Text style={[styles.meta, { color: card.ink }]}>
                        {item.homecoming ? `${t.cameHome} · ` : ''}
                        {item.origin ? t.fromCity(item.origin) : t.fromSomewhere}
                      </Text>
                      <Text style={[styles.meta, { color: card.ink }]}>{formatDate(item.delivered_at)}</Text>
                      {item.hops > 0 ? <Text style={[styles.meta, { color: card.ink }]}>{t.relayCount(item.hops)}</Text> : null}
                      {item.hops > 0 && cities.some((c) => c !== '?') ? <Text style={[styles.meta, { color: card.ink }]}>{cities.join(` ${ARROW} `)}</Text> : null}
                    </View>
                    {item.relayed ? (
                      <Text style={[styles.done, { color: card.ink }]}>✓ {t.relayed}</Text>
                    ) : item.homecoming ? null : (
                      <Pressable
                        onPress={() => relay(item)}
                        disabled={relaying !== undefined}
                        accessibilityRole="button"
                        style={[styles.relay, { borderColor: card.ink }]}
                      >
                        {relaying === item.letter ? (
                          <ActivityIndicator size="small" color={card.ink} />
                        ) : (
                          <Text style={[styles.relayText, { color: card.ink }]}>{t.relayButton}</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                  {clover ? <Image source={{ uri: clover }} style={styles.clover} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
                </Pressable>
              );
            }
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/journey/[chain]', params: { chain: item.chain } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, { backgroundColor: card.bg, opacity: pressed ? 0.85 : 1 }]}
              >
                <CardArt card={item.card_key} size={44} />
                <View style={styles.rowText}>
                  <Text style={[styles.message, { color: card.ink }]}>
                    {letterMessage(t, item.message_key)}
                  </Text>
                  <Text style={[styles.hops, { color: card.ink }]}>
                    {t.journeyHops(item.hops)}
                    {item.came_home ? ` · ${t.cameHome}` : ''}
                  </Text>
                  {cities.length ? (
                    <Text style={[styles.meta, { color: card.ink }]}>
                      {t.journeyNow(cities[cities.length - 1])}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="earth" size={22} color={card.ink} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

/** A received letter's art: on a tap it squishes and bounces back while little clovers pop out around it. */
function PoppingArt({ card, trigger }: { card: number; trigger: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!trigger) return;
    scale.value = withSequence(withTiming(0.78, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 320 }));
  }, [trigger, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View>
      <Animated.View style={style}>
        <CardArt card={card} size={44} />
      </Animated.View>
      <LuckBurst trigger={trigger} scale={0.38} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { marginTop: 48 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginHorizontal: 16, marginBottom: 12 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, fontFamily: FONT.cute },
  list: { paddingHorizontal: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14 },
  rowText: { flex: 1, gap: 4 },
  clover: { width: 64, height: 64, borderRadius: 12, borderWidth: 3, borderColor: '#fff', transform: [{ rotate: '4deg' }] },
  message: { fontSize: 15, lineHeight: 21, fontFamily: FONT.cute },
  meta: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18, opacity: 0.8 },
  hops: { fontFamily: FONT.medium, fontSize: 13 },
  done: { fontFamily: FONT.medium, fontSize: 12, marginTop: 2 },
  relay: { alignSelf: 'flex-start', minHeight: 32, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center', marginTop: 4 },
  relayText: { fontFamily: FONT.medium, fontSize: 13 },
  passport: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16, backgroundColor: COVER },
  passportTitle: { fontFamily: FONT.cute, fontSize: 16, color: GILT },
  passportMeta: { fontFamily: FONT.body, fontSize: 12, color: '#FFFBEF', opacity: 0.85 },
  empty: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 64, paddingHorizontal: 32 },
});
