/**
 * Lucky Map: the spot (pin) of AI-confirmed finds a user chooses to publish, with the find's small clover
 * close-up (never the original photo). Anonymous Supabase account per install, created on first share; no login UI.
 * Server rules live in supabase/schema.sql and supabase/clover_photos.sql.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { createClient } from '@supabase/supabase-js';
import { getCalendars } from 'expo-localization';

import { BACKEND } from '../config/backend';
import type { Hop } from '../letters';
import { getFind, getSettings, updateFind, updateSettings, type Find } from './findsStore';
import { cityCenter } from './location';
import { randomNickname } from '../nicknames';
import { OWNER_USER_ID, SAMPLE_JOURNEYS, SAMPLE_LETTER, WORLD_JOURNEY } from '../sampleJourneys';

export const sharingAvailable = Boolean(BACKEND.url && BACKEND.anonKey);

const supabase = createClient(BACKEND.url || 'https://unconfigured.invalid', BACKEND.anonKey || 'unconfigured', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export type SharedFind = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  place: string | null;
  found_at: string;
  has_photo: boolean;
  /** Hidden for everyone after enough reports (report_find). */
  hidden: boolean;
};

const BUCKET = 'clovers';

/** Public URL of a pin's clover close-up, or undefined when it has none or was hidden by reports. */
export function cloverPhotoUrl(item: SharedFind) {
  return item.has_photo && !item.hidden
    ? `${BACKEND.url}/storage/v1/object/public/${BUCKET}/${item.user_id}/${item.id}.jpg`
    : undefined;
}

/** Public URL of the clover close-up a letter carries (`<user>/<uuid>.jpg`). */
export const letterPhotoUrl = (path: string) => `${BACKEND.url}/storage/v1/object/public/${BUCKET}/${path}`;

/** Uploads a clover close-up to my folder of the public clovers bucket. */
async function uploadClover(uri: string, path: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = Uint8Array.from(globalThis.atob(base64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
}

/** Random v4 id, so the photo can be uploaded under the pin's id before the (immutable) row exists. */
function uuid() {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type Bounds = { south: number; north: number; west: number; east: number };

export function canShare(find: Find) {
  return find.aiDetected && find.latitude != null && find.longitude != null;
}

async function myUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) throw error ?? new Error('sharing: anonymous sign-in failed');
  return signedIn.user.id;
}

/** This install's anonymous account tokens, for a backup; undefined if it never signed in. */
export async function exportSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { access_token: data.session.access_token, refresh_token: data.session.refresh_token } : undefined;
}

/**
 * Signs this install into a backed-up account. Needs the network, and fails once the old phone has refreshed
 * its tokens (Supabase rotates refresh tokens), so a backup should be restored soon after it is made.
 */
export async function importSession(tokens: { access_token: string; refresh_token: string }) {
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw error;
}

/** Signed-in user id if a session exists, without creating an account. */
export async function currentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export async function shareFind(find: Find): Promise<string> {
  if (!canShare(find)) throw new Error('sharing: find is not shareable');
  const uid = await myUserId();
  const id = uuid();
  const photoPath = `${uid}/${id}.jpg`;
  if (find.cloverUri) await uploadClover(find.cloverUri, photoPath);
  const { error } = await supabase.from('shared_finds').insert({
    id,
    latitude: find.latitude,
    longitude: find.longitude,
    place: find.place?.slice(0, 120) ?? null,
    found_at: find.createdAt,
    has_photo: Boolean(find.cloverUri),
  });
  if (error) {
    if (find.cloverUri) await supabase.storage.from(BUCKET).remove([photoPath]).catch(() => {});
    throw error;
  }
  await updateFind(find.id, { sharedId: id });
  return id;
}

export async function unshareFind(find: Find) {
  if (!find.sharedId) return;
  const uid = await myUserId();
  const { error } = await supabase.from('shared_finds').delete().eq('id', find.sharedId);
  if (error) throw error;
  // Older pins have no photo; removing a missing object is not an error.
  await supabase.storage.from(BUCKET).remove([`${uid}/${find.sharedId}.jpg`]);
  if (getFind(find.id)) await updateFind(find.id, { sharedId: undefined });
}

/** Removes every pin and clover photo of this install from the server (settings → remove my pins / delete all). */
export async function unshareAll(finds: Find[]) {
  const uid = await currentUserId();
  if (uid) {
    const { error } = await supabase.from('shared_finds').delete().eq('user_id', uid);
    if (error) throw error;
    for (;;) {
      const { data: files, error: listError } = await supabase.storage.from(BUCKET).list(uid, { limit: 100 });
      if (listError) throw listError;
      if (!files?.length) break;
      const { data: removed, error: removeError } = await supabase.storage.from(BUCKET).remove(files.map((f) => `${uid}/${f.name}`));
      if (removeError) throw removeError;
      if (!removed?.length) break; // storage policy refused silently; don't loop forever
    }
  }
  for (const find of finds) if (find.sharedId && getFind(find.id)) await updateFind(find.id, { sharedId: undefined });
}

/** Pins in `bounds`, optionally only one person's (`user`). */
export async function fetchShared(bounds: Bounds, user?: string, limit = 500): Promise<SharedFind[]> {
  const query = (west: number, east: number) => {
    let q = supabase
      .from('shared_finds')
      .select('id, user_id, latitude, longitude, place, found_at, has_photo, hidden')
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', west)
      .lte('longitude', east);
    if (user) q = q.eq('user_id', user);
    return q.order('created_at', { ascending: false }).limit(limit);
  };
  // A view crossing the antimeridian (west > east) is two longitude ranges.
  const parts =
    bounds.west <= bounds.east
      ? [query(bounds.west, bounds.east)]
      : [query(bounds.west, 180), query(-180, bounds.east)];
  const results = await Promise.all(parts);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  return results.flatMap((r) => (r.data ?? []) as SharedFind[]);
}

/** Reports a pin's photo; the server hides it for everyone after a few reports (supabase/clover_photos.sql). */
export async function reportFind(id: string) {
  await myUserId();
  const { error } = await supabase.rpc('report_find', { p_find: id });
  if (error) throw error;
}

// ── Lucky letters: curated luck to a random stranger (supabase/lucky_letters.sql) ──

export type LuckyLetter = {
  id: string;
  message_key: number;
  card_key: number;
  origin: string | null;
  delivered_at: string | null;
  hops: number;
  route: Hop[];
  homecoming: boolean;
  /** Hello Luck's own cheer for someone nobody wrote to lately: no sender to thank. */
  from_app?: boolean;
};

/** Where the sender is: city name plus a point the server rounds to 0.1° (≈11 km). */
export type Place = { city?: string; lat?: number; lng?: number };

/** The name id my letters go out under, picked at random the first time it is needed. */
export async function myNickname() {
  const { nickname } = getSettings();
  if (nickname >= 0) return nickname;
  const picked = randomNickname();
  await updateSettings({ nickname: picked });
  return picked;
}

/**
 * A new letter, or with `parent` a relay of a letter I received (the server keeps its card, message and clover).
 * `cloverUri`: the find's clover close-up, sent along with a new letter.
 * Returns the new letter's id, which for a new letter is also its journey (chain) id.
 */
export async function sendLuckyLetter(messageKey: number, cardKey: number, place?: Place, parent?: string, cloverUri?: string): Promise<string> {
  const uid = await myUserId();
  let photo: string | null = null;
  if (cloverUri) {
    const path = `${uid}/${uuid()}.jpg`;
    // The letter still goes out without its clover if the upload fails.
    photo = await uploadClover(cloverUri, path).then(
      () => path,
      (error) => {
        console.warn('letter: clover upload failed', error);
        return null;
      },
    );
  }
  const { data, error } = await supabase.rpc('send_lucky_letter', {
    p_message: messageKey,
    p_card: cardKey,
    p_origin: place?.city ?? null,
    p_lat: place?.lat ?? null,
    p_lng: place?.lng ?? null,
    p_parent: parent ?? null,
    p_nick: await myNickname(),
    p_photo: photo,
  });
  if (error) throw error;
  return data as string;
}

/** Marks this install as present (so it can receive), adopts a waiting letter, and returns arrived unopened mail. */
export async function checkMailbox(lang: string): Promise<LuckyLetter[]> {
  await myUserId();
  const tz = getCalendars()[0]?.timeZone ?? null;
  const { data, error } = await supabase.rpc('check_mailbox', { p_lang: lang, p_tz: tz });
  if (error) throw error;
  return (data ?? []) as LuckyLetter[];
}

export async function openLetter(id: string) {
  const { error } = await supabase.rpc('open_letter', { p_letter: id });
  if (error) throw error;
}

export async function thankLetter(id: string, sticker: number, city?: string) {
  const { error } = await supabase.rpc('thank_letter', { p_letter: id, p_sticker: sticker, p_city: city ?? null });
  if (error) throw error;
}

export type Thanks = { letter: string; message_key: number; card_key: number; thanks_key: number; thanks_city: string | null };

/** Thank-yous for letters I sent that I haven't seen yet (the server marks them seen). */
export async function myThanks(): Promise<Thanks[]> {
  await myUserId();
  const { data, error } = await supabase.rpc('my_thanks');
  if (error) throw error;
  return (data ?? []) as Thanks[];
}

export type KeptLetter = {
  letter: string;
  message_key: number;
  card_key: number;
  origin: string | null;
  hops: number;
  route: Hop[];
  homecoming: boolean;
  delivered_at: string;
  relayed: boolean;
  thanked: boolean;
  /** The sender's clover close-up (letterPhotoUrl), if the letter carries one. */
  photo?: string | null;
  from_app?: boolean;
};

/** The clover a received letter shows; the samples borrow `latest`, my newest clover. */
export const letterClover = (item: KeptLetter, latest?: string) =>
  item.letter.startsWith('sample-') ? latest : item.photo ? letterPhotoUrl(item.photo) : undefined;

export async function myLetters(): Promise<KeptLetter[]> {
  const me = await myUserId();
  const { data, error } = await supabase.rpc('my_letters');
  if (error) throw error;
  const letters = (data ?? []) as KeptLetter[];
  return __DEV__ || me === OWNER_USER_ID ? [SAMPLE_LETTER, ...letters] : letters;
}

export type Journey = {
  chain: string;
  message_key: number;
  card_key: number;
  hops: number;
  route: Hop[];
  came_home: boolean;
  started_by_me: boolean;
  updated_at: string;
};

/** Every relay chain I took part in, at its furthest point. */
export async function myJourneys(): Promise<Journey[]> {
  const me = await myUserId();
  const { data, error } = await supabase.rpc('my_journeys');
  if (error) throw error;
  const journeys = (data ?? []) as Journey[];
  if (__DEV__ || me === OWNER_USER_ID) journeys.push(WORLD_JOURNEY);
  if (__DEV__) journeys.push(...SAMPLE_JOURNEYS);
  // Stops are stored rounded to 0.1° (privacy); pin each at its city's center so it lands where the name says.
  const placed = await Promise.all(
    journeys.map(async (j) => ({
      ...j,
      route: await Promise.all(
        j.route.map(async (hop) => {
          if (!hop.c || typeof hop.la !== 'number' || typeof hop.lo !== 'number') return hop;
          const center = await cityCenter(hop.c, { la: hop.la, lo: hop.lo });
          return center ? { ...hop, la: center.la, lo: center.lo } : hop;
        }),
      ),
    })),
  );
  return placed.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** People my luck has reached so far (every delivery along chains I sent or relayed into). */
export async function myEcho(): Promise<number> {
  await myUserId();
  const { data, error } = await supabase.rpc('my_echo');
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Letters sent anywhere in the last 24 hours. */
export async function luckToday(): Promise<number> {
  const { data, error } = await supabase.rpc('luck_today');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function savePushToken(token: string, lang: string) {
  await myUserId();
  const { error } = await supabase.rpc('set_push_token', { p_token: token, p_lang: lang });
  if (error) throw error;
}
