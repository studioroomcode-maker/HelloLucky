import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, FONT } from '@/constants/theme';
import { CHEVRON_BACK, formatDate, t } from '@/src/i18n';
import { bumpCounters, deleteFind, getSettings, MAP_RULES, updateFind, updateSettings, useFinds, useSettings } from '@/src/services/findsStore';
import { canShare, shareFind, sharingAvailable, unshareFind } from '@/src/services/sharing';
import { projectToView } from '@/src/services/detector/frameMapping';
import { SHARE_URL } from '@/src/config/links';
import { copyShareText } from '@/src/shareText';
import { PrimaryButton } from '@/src/ui/PrimaryButton';
import { fortuneFor } from '@/src/fortune';
import { FoundPopup } from '@/src/ui/FoundPopup';
import { LuckBurst } from '@/src/ui/LuckBurst';
import { SendLuckSheet } from '@/src/ui/SendLuckSheet';
import { CornerFrame } from '@/src/ui/TrackBox';

/** Google Maps on both platforms: the app when installed (universal link), otherwise the website. */
function mapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export default function FindDetail() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const [celebrate, setCelebrate] = useState(!!fresh);
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const find = useFinds().find((item) => item.id === id);
  const [note, setNote] = useState(find?.note ?? '');
  const scrollRef = useRef<ScrollView>(null);
  const photoRef = useRef<View>(null);
  const settings = useSettings();
  const [mapBusy, setMapBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [photoView, setPhotoView] = useState({ width: 0, height: 0 });

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!find) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top }]}>
        <Text style={[styles.missingText, { color: palette.muted }]}>{t.notFound}</Text>
        <PrimaryButton label={t.done} onPress={goHome} variant="secondary" />
      </View>
    );
  }

  const hasLocation = find.latitude != null && find.longitude != null;

  const saveNote = () => {
    if (note !== find.note) updateFind(find.id, { note: note.trim() }).catch(() => Alert.alert(t.saveError));
  };

  // Share the on-screen photo (with its watermark) plus an invite line, so friends can find the app.
  const share = async (note: string) => {
    setSendOpen(false);
    try {
      const uri = await captureRef(photoRef, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
      const message = [note, t.shareLink(SHARE_URL)].filter(Boolean).join('\n\n');
      await copyShareText(message);
      const result = await Share.open({
        url: uri.startsWith('file://') ? uri : `file://${uri}`,
        type: 'image/jpeg',
        message,
        failOnCancel: false,
      });
      if (result.success) bumpCounters({ sentLuck: 1 }).catch(() => {});
    } catch (error) {
      console.warn('detail: share failed', error);
    }
  };

  const publish = async () => {
    setMapBusy(true);
    try {
      await shareFind(find);
    } catch (error) {
      console.warn('detail: share failed', error);
      Alert.alert(/rate_limit/.test(String((error as Error)?.message)) ? t.shareRateLimit : t.shareError);
    } finally {
      setMapBusy(false);
    }
  };

  const shareToMap = () => {
    if (settings.mapRules >= MAP_RULES) return publish();
    Alert.alert(t.rulesTitle, t.rulesBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.rulesAgree,
        onPress: async () => {
          await updateSettings({ mapRules: MAP_RULES });
          publish();
        },
      },
    ]);
  };

  const stopSharing = () => {
    Alert.alert(t.unshareConfirm, undefined, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.unshare,
        style: 'destructive',
        onPress: async () => {
          setMapBusy(true);
          await unshareFind(find).catch(() => Alert.alert(t.shareError));
          setMapBusy(false);
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(t.deleteConfirmTitle, t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          goHome();
          // Best effort: a delete without network still removes the find locally.
          await unshareFind(find).catch((error) => console.warn('detail: unshare on delete failed', error));
          await deleteFind(find.id);
        },
      },
    ]);
  };

  return (
    // Android 15+ is edge-to-edge, so adjustResize no longer shrinks the window: pad on both platforms.
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          ref={photoRef}
          collapsable={false}
          style={styles.photo}
          onLayout={(event: LayoutChangeEvent) => setPhotoView(event.nativeEvent.layout)}
        >
          <Image
            source={{ uri: find.photoUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          {find.cloverBox && find.photoAspect && photoView.width ? (
            // Where the AI saw the clover, on the photo as it is drawn ("cover"); shared images keep it too.
            <CornerFrame
              rect={projectToView(
                {
                  x: find.cloverBox.x * find.photoAspect,
                  y: find.cloverBox.y,
                  width: find.cloverBox.width * find.photoAspect,
                  height: find.cloverBox.height,
                  confidence: 1,
                },
                find.photoAspect,
                1,
                photoView.width,
                photoView.height,
              )}
            />
          ) : null}
          <Image
            source={require('@/assets/logo.png')}
            style={styles.watermark}
            contentFit="contain"
            accessible={false}
          />
        </View>

        <View style={styles.content}>
          {fresh ? (
            <Text style={[styles.freshTitle, { color: palette.primary }]} accessibilityRole="header">
              {t.newFindTitle}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={[styles.date, { color: palette.text }]}>{formatDate(find.createdAt)}</Text>
            {find.aiDetected ? (
              <View style={[styles.aiChip, { backgroundColor: palette.surfaceAlt }]}>
                <Ionicons name="sparkles" size={13} color={palette.primary} />
                <Text style={[styles.aiChipText, { color: palette.primary }]}>{t.aiFound}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.fortune, { backgroundColor: palette.surfaceAlt }]}>
            <View style={styles.fortuneHead}>
              <Ionicons name="sparkles" size={15} color={palette.primary} />
              <Text style={[styles.fortuneLabel, { color: palette.primary }]}>{t.fortuneLabel}</Text>
            </View>
            <Text style={[styles.fortuneText, { color: palette.text }]}>{fortuneFor(find)}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Ionicons name="location-outline" size={20} color={palette.muted} />
            <Text
              style={[styles.cardText, { color: hasLocation ? palette.text : palette.muted }]}
              numberOfLines={2}
            >
              {find.place ??
                (hasLocation ? `${find.latitude!.toFixed(4)}, ${find.longitude!.toFixed(4)}` : t.noPlace)}
            </Text>
            {hasLocation ? (
              <Pressable
                onPress={() => Linking.openURL(mapUrl(find.latitude!, find.longitude!)).catch(() => {})}
                hitSlop={8}
                accessibilityRole="link"
              >
                <Text style={[styles.link, { color: palette.primary }]}>{t.openMap}</Text>
              </Pressable>
            ) : null}
          </View>

          {sharingAvailable ? (
            find.sharedId ? (
              <View
                style={[styles.card, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
              >
                {/* What the map shows: the clover close-up, never this photo. */}
                {find.cloverUri ? (
                  <Image source={{ uri: find.cloverUri }} style={styles.cloverThumb} contentFit="cover" />
                ) : (
                  <Ionicons name="earth" size={20} color={palette.primary} />
                )}
                <Text style={[styles.cardText, { color: palette.text }]}>{t.sharedOnMap}</Text>
                <Pressable onPress={stopSharing} disabled={mapBusy} hitSlop={8} accessibilityRole="button">
                  <Text style={[styles.link, { color: palette.danger }]}>{t.unshare}</Text>
                </Pressable>
              </View>
            ) : canShare(find) ? (
              <PrimaryButton
                icon="earth"
                label={t.shareToMap}
                onPress={shareToMap}
                loading={mapBusy}
                variant="secondary"
              />
            ) : (
              <Text style={[styles.hint, { color: palette.muted }]}>
                {find.aiDetected ? t.shareNeedsLocation : t.shareNeedsAi}
              </Text>
            )
          ) : null}

          <Text style={[styles.label, { color: palette.muted }]}>{t.noteLabel}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            onBlur={saveNote}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            placeholder={t.notePlaceholder}
            placeholderTextColor={palette.muted}
            multiline
            maxLength={500}
            accessibilityLabel={t.noteLabel}
            style={[
              styles.note,
              { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          />

          <View style={styles.actions}>
            <View style={styles.action}>
              <PrimaryButton
                icon="paper-plane-outline"
                label={t.share}
                onPress={() => setSendOpen(true)}
                variant="secondary"
              />
            </View>
            <View style={styles.done}>
              <PrimaryButton
                icon="checkmark"
                label={t.done}
                onPress={() => {
                  saveNote();
                  goHome();
                }}
              />
            </View>
          </View>

          <Pressable onPress={confirmDelete} style={styles.deleteBtn} accessibilityRole="button" hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={palette.danger} />
            <Text style={[styles.deleteText, { color: palette.danger }]}>{t.delete}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          saveNote();
          goHome();
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t.close}
        style={[styles.back, { top: insets.top + 8 }]}
      >
        <Ionicons name={CHEVRON_BACK} size={26} color="#fff" />
      </Pressable>
      {/* A fresh find gets one more pop of clovers on arrival. */}
      <LuckBurst trigger={fresh ? 1 : 0} />
      <FoundPopup visible={celebrate} onClose={() => setCelebrate(false)} />
      <SendLuckSheet
        photoUri={find.photoUri}
        cloverUri={find.cloverUri}
        fortune={fortuneFor(find)}
        place={{ city: find.city, lat: find.latitude, lng: find.longitude }}
        onStrangerSent={(chain) => {
          bumpCounters({ sentLuck: 1 }).catch(() => {});
          // Remember which find started this journey, so its card can show the clover.
          updateSettings({ journeyFinds: { ...getSettings().journeyFinds, [chain]: find.id } }).catch(() => {});
        }}
        visible={sendOpen}
        onClose={() => setSendOpen(false)}
        onSend={share}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  missingText: { fontFamily: FONT.body, fontSize: 16 },
  photo: { width: '100%', aspectRatio: 3 / 4, maxHeight: 520, backgroundColor: '#000' },
  watermark: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: '15%',
    aspectRatio: 366 / 290,
    opacity: 0.55,
  },
  back: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 20, gap: 14 },
  freshTitle: { fontSize: 24, fontFamily: FONT.cute, letterSpacing: -0.4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { fontSize: 17, fontFamily: FONT.cute },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  aiChipText: { fontSize: 13, fontFamily: FONT.cute },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  cardText: { fontFamily: FONT.body, flex: 1, fontSize: 15 },
  cloverThumb: { width: 40, height: 40, borderRadius: 10 },
  link: { fontSize: 15, fontFamily: FONT.cute },
  label: { fontFamily: FONT.medium, fontSize: 14, marginTop: 4 },
  hint: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  fortune: { borderRadius: 18, padding: 16, gap: 6 },
  fortuneHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fortuneLabel: { fontSize: 14, fontFamily: FONT.cute },
  fortuneText: { fontSize: 17, lineHeight: 24, fontFamily: FONT.cute },
  note: { fontFamily: FONT.body, minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  // Each button starts at its label's width and both grow to fill, so a long Send label wraps between words.
  action: { flexGrow: 1, flexShrink: 1 },
  // Done is one short word: it keeps its width and only Send wraps.
  done: { flexGrow: 1, flexShrink: 0 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  deleteText: { fontFamily: FONT.medium, fontSize: 15 },
});
