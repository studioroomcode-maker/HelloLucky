import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, usePalette } from '@/constants/theme';
import { t } from '@/src/i18n';
import { letterMessage, randomKey } from '@/src/letters';
import { notificationsGranted, enableLuckNotifications } from '@/src/services/notifications';
import { sendLuckyLetter, sharingAvailable, type Place } from '@/src/services/sharing';
import { EVERYDAY_CARDS, LuckCard } from '@/src/ui/LuckCard';
import { SPECIAL_CARD, specialDay } from '@/src/warm';
import { PrimaryButton } from '@/src/ui/PrimaryButton';

const pick = (n: number) => Math.floor(Math.random() * n);
// On a special day every letter wears that day's card.
const pickCard = () => {
  const day = specialDay(new Date());
  return day ? SPECIAL_CARD[day] : pick(EVERYDAY_CARDS);
};

/**
 * "Send luck" sheet. Friend mode: photo preview + an editable message, handed to the system share sheet.
 * Stranger mode: a curated luck line or cheer on a random card flies to a random Hello Luck user (no photo, city only).
 */
export function SendLuckSheet({
  photoUri,
  fortune,
  place,
  visible,
  onClose,
  onSend,
  onStrangerSent,
}: {
  photoUri: string;
  fortune: string;
  place?: Place;
  visible: boolean;
  onClose: () => void;
  onSend: (note: string) => Promise<void>;
  onStrangerSent: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const initial = `${t.sendLuckDefault}\n\n🔮 ${t.fortuneLabel}: ${fortune}`;
  const [note, setNote] = useState(initial);
  const [mode, setMode] = useState<'friend' | 'stranger'>('friend');
  const [topic, setTopic] = useState(-1); // -1 luck lines, 0–4 cheer topics
  const [message, setMessage] = useState(() => randomKey(t, -1));
  const [card, setCard] = useState(pickCard);
  const [busy, setBusy] = useState(false);

  const sendFriend = async () => {
    setBusy(true);
    try {
      await onSend(note.trim());
      setNote(initial);
    } finally {
      setBusy(false);
    }
  };

  const sendStranger = async () => {
    setBusy(true);
    try {
      await sendLuckyLetter(message, card, place);
      onStrangerSent();
      onClose();
      setMessage(randomKey(t, topic));
      setCard(pickCard());
      // Ask for push once the user has felt what a lucky letter is.
      const ask = !(await notificationsGranted());
      Alert.alert(t.strangerSent, ask ? t.notifyAskBody : undefined, ask
        ? [
            { text: t.notifyNo, style: 'cancel' },
            { text: t.notifyYes, onPress: () => enableLuckNotifications() },
          ]
        : undefined);
    } catch (error) {
      console.warn('send: lucky letter failed', error);
      Alert.alert(/rate_limit/.test(String((error as Error)?.message)) ? t.strangerRateLimit : t.shareError);
    } finally {
      setBusy(false);
    }
  };

  const tab = (value: 'friend' | 'stranger', label: string) => (
    <Pressable
      onPress={() => setMode(value)}
      accessibilityRole="tab"
      accessibilityState={{ selected: mode === value }}
      style={[styles.tab, mode === value && { backgroundColor: palette.surface }]}
    >
      <Text style={[styles.tabText, { color: mode === value ? palette.text : palette.muted }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.cancel} />
        <View style={[styles.sheet, { backgroundColor: palette.surface, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
            {t.sendLuckTitle}
          </Text>
          {sharingAvailable ? (
            <View style={[styles.tabs, { backgroundColor: palette.surfaceAlt }]} accessibilityRole="tablist">
              {tab('friend', t.sendToFriend)}
              {tab('stranger', t.sendToStranger)}
            </View>
          ) : null}

          {mode === 'friend' ? (
            <>
              <View style={styles.preview}>
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Image source={require('@/assets/logo.png')} style={styles.watermark} contentFit="contain" />
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t.sendLuckPlaceholder}
                placeholderTextColor={palette.muted}
                maxLength={300}
                multiline
                accessibilityLabel={t.sendLuckPlaceholder}
                style={[styles.input, { color: palette.text, backgroundColor: palette.surfaceAlt }]}
              />
              <PrimaryButton icon="paper-plane" label={t.sendLuckButton} onPress={sendFriend} loading={busy} />
            </>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
                {[t.luckTopic, ...t.cheerTopics].map((label, i) => {
                  const value = i - 1;
                  const on = topic === value;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => {
                        setTopic(value);
                        setMessage(randomKey(t, value));
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.topic, { backgroundColor: on ? palette.primary : palette.surfaceAlt }]}
                    >
                      <Text style={[styles.topicText, { color: on ? palette.onPrimary : palette.text }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <LuckCard
                card={card}
                message={letterMessage(t, message)}
                footer={place?.city ? t.fromCity(place.city) : t.fromSomewhere}
              />
              <Pressable
                onPress={() => {
                  setMessage((m) => randomKey(t, topic, m));
                  setCard(pickCard());
                }}
                accessibilityRole="button"
                style={styles.shuffle}
                hitSlop={8}
              >
                <Ionicons name="shuffle" size={18} color={palette.primary} />
                <Text style={[styles.shuffleText, { color: palette.primary }]}>{t.shuffle}</Text>
              </Pressable>
              <Text style={[styles.intro, { color: palette.muted }]}>{t.strangerIntro}</Text>
              <PrimaryButton icon="balloon" label={t.sendStranger} onPress={sendStranger} loading={busy} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  title: { fontSize: 20, fontFamily: FONT.cute, textAlign: 'center' },
  tabs: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  tabText: { fontSize: 15, fontFamily: FONT.cute },
  preview: { alignSelf: 'center', width: 150, aspectRatio: 3 / 4, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  watermark: { position: 'absolute', right: 8, bottom: 8, width: '15%', aspectRatio: 366 / 290, opacity: 0.55 },
  input: { fontFamily: FONT.body, minHeight: 64, borderRadius: 16, padding: 14, fontSize: 16, textAlignVertical: 'top' },
  topics: { gap: 8, paddingHorizontal: 2 },
  topic: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  topicText: { fontFamily: FONT.medium, fontSize: 14 },
  shuffle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  shuffleText: { fontSize: 15, fontFamily: FONT.cute },
  intro: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
