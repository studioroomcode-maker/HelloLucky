import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { FONT, usePalette } from '@/constants/theme';
import { t } from '@/src/i18n';
import { letterMessage, routeCities } from '@/src/letters';
import { Envelope, Sticker, STICKER_COUNT } from '@/src/ui/art';
import { playChime } from '@/src/services/chime';
import { sendLuckyLetter, thankLetter, type LuckyLetter, type Place } from '@/src/services/sharing';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { LuckCard } from '@/src/ui/LuckCard';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

/**
 * A sealed envelope that wiggles until tapped, then reveals a stranger's luck card.
 * The reader can send a thank-you sticker back and pass the same card on to someone new.
 */
export function LetterPopup({
  letter,
  place,
  onDone,
  onRelayed,
  onThanked,
}: {
  letter?: LuckyLetter;
  place?: Place;
  onDone: (letter: LuckyLetter) => void;
  onRelayed: () => void;
  onThanked: () => void;
}) {
  const palette = usePalette();
  const [opened, setOpened] = useState(false);
  const [thanked, setThanked] = useState<number>();
  const [relayed, setRelayed] = useState(false);
  const [busy, setBusy] = useState(false);
  const wiggle = useRef(new Animated.Value(0)).current;
  const arrive = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setOpened(false);
    setThanked(undefined);
    setRelayed(false);
    if (!letter) return;
    // Arrival: the envelope flies in, a two-beat "thump-thump" and a soft bell.
    playChime();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const beat = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 160);
    arrive.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then(
      (reduced) =>
        reduced
          ? arrive.setValue(1)
          : Animated.spring(arrive, {
              toValue: 1,
              friction: 6,
              tension: 50,
              useNativeDriver: true,
            }).start(),
      () => arrive.setValue(1),
    );
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 140,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: -1,
          duration: 280,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 0,
          duration: 140,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      clearTimeout(beat);
    };
  }, [letter, wiggle, arrive]);

  if (!letter) return null;

  const thank = (sticker: number) => {
    if (thanked !== undefined) return;
    setThanked(sticker);
    thankLetter(letter.id, sticker, place?.city).then(onThanked, (error) => {
      console.warn('letter: thanks failed', error);
      setThanked(undefined);
    });
  };

  const relay = async () => {
    setBusy(true);
    try {
      await sendLuckyLetter(letter.message_key, letter.card_key, place, letter.id);
      setRelayed(true);
      onRelayed();
      Alert.alert(t.relaySent);
    } catch (error) {
      const message = String((error as Error)?.message);
      if (/already_relayed/.test(message)) setRelayed(true);
      Alert.alert(
        /rate_limit/.test(message) ? t.strangerRateLimit : /already_relayed/.test(message) ? t.relayDone : t.shareError,
      );
    } finally {
      setBusy(false);
    }
  };

  const cities = routeCities(letter.route ?? []);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => onDone(letter)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
          <Text style={[styles.title, { color: palette.primary }]}>{letter.homecoming ? t.homecomingTitle : t.mailTitle}</Text>
          {opened ? (
            <>
              <LuckCard
                card={letter.card_key}
                message={letterMessage(t, letter.message_key)}
                footer={letter.origin ? t.fromCity(letter.origin) : t.fromSomewhere}
              />
              {letter.hops > 0 ? (
                <View style={styles.route}>
                  <Text style={[styles.routeLead, { color: palette.text }]}>
                    {letter.homecoming ? t.homecomingBody(letter.hops) : t.relayCount(letter.hops)}
                  </Text>
                  <Text style={[styles.routeCities, { color: palette.muted }]}>{cities.join(' → ')}</Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: palette.muted }]}>{thanked === undefined ? t.thanksTitle : t.thanksSent}</Text>
              <View style={styles.stickers}>
                {Array.from({ length: STICKER_COUNT }, (_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => thank(i)}
                    disabled={thanked !== undefined}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.thanksTitle} ${i + 1}`}
                    style={[
                      styles.sticker,
                      {
                        backgroundColor: thanked === i ? palette.surfaceAlt : 'transparent',
                      },
                      thanked !== undefined && thanked !== i && styles.dim,
                    ]}
                  >
                    <Sticker index={i} size={32} />
                  </Pressable>
                ))}
              </View>

              {letter.homecoming ? null : (
                <PrimaryButton
                  icon="paper-plane"
                  label={relayed ? t.relayDone : t.relayButton}
                  onPress={relay}
                  loading={busy}
                  disabled={relayed}
                />
              )}
              <Pressable onPress={() => onDone(letter)} accessibilityRole="button" hitSlop={8} style={styles.close}>
                <Text style={[styles.closeText, { color: palette.muted }]}>{t.close}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => setOpened(true)} accessibilityRole="button" accessibilityLabel={t.mailTap}>
              <Animated.View
                style={{
                  opacity: arrive,
                  transform: [
                    {
                      translateY: arrive.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-240, 0],
                      }),
                    },
                    {
                      rotate: arrive.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-25deg', '0deg'],
                      }),
                    },
                    {
                      scale: arrive.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                }}
              >
                <Animated.View
                  style={[
                    styles.envelope,
                    {
                      transform: [
                        {
                          rotate: wiggle.interpolate({
                            inputRange: [-1, 1],
                            outputRange: ['-8deg', '8deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Envelope size={120} homecoming={letter.homecoming} />
                </Animated.View>
              </Animated.View>
              <Text style={[styles.tap, { color: palette.muted }]}>{t.mailTap}</Text>
            </Pressable>
          )}
        </View>
        <LuckBurst trigger={opened ? 1 : 0} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 22,
    gap: 12,
    alignItems: 'stretch',
  },
  title: { fontSize: 20, fontFamily: FONT.cute, textAlign: 'center' },
  route: { alignItems: 'center', gap: 2 },
  routeLead: { fontFamily: FONT.medium, fontSize: 14, textAlign: 'center' },
  routeCities: { fontFamily: FONT.body, fontSize: 13, textAlign: 'center' },
  label: {
    fontFamily: FONT.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  stickers: { flexDirection: 'row', justifyContent: 'space-between' },
  sticker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.3 },
  close: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16 },
  closeText: { fontFamily: FONT.medium, fontSize: 15 },
  envelope: { alignSelf: 'center', marginVertical: 8 },
  tap: { fontFamily: FONT.body, fontSize: 14, textAlign: 'center' },
});
