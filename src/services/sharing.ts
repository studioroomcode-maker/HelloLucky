/**
 * Lucky Map: the spot (pin) of AI-confirmed finds a user chooses to publish. Photos never leave the device.
 * Anonymous Supabase account per install, created on first share; no login UI.
 * Server rules live in supabase/schema.sql.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { getCalendars } from 'expo-localization';

import { BACKEND } from '../config/backend';
import type { Hop } from '../letters';
import { getFind, updateFind, type Find } from './findsStore';

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
};

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

/** Signed-in user id if a session exists, without creating an account. */
export async function currentUserId(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export async function shareFind(find: Find): Promise<string> {
  if (!canShare(find)) throw new Error('sharing: find is not shareable');
  await myUserId();
  const { data, error } = await supabase
    .from('shared_finds')
    .insert({
      latitude: find.latitude,
      longitude: find.longitude,
      place: find.place?.slice(0, 120) ?? null,
      found_at: find.createdAt,
    })
    .select('id')
    .single();
  if (error) throw error;
  await updateFind(find.id, { sharedId: data.id });
  return data.id;
}

export async function unshareFind(find: Find) {
  if (!find.sharedId) return;
  await myUserId();
  const { error } = await supabase.from('shared_finds').delete().eq('id', find.sharedId);
  if (error) throw error;
  if (getFind(find.id)) await updateFind(find.id, { sharedId: undefined });
}

/** Removes every pin of this install from the server (settings → remove my pins / delete all). */
export async function unshareAll(finds: Find[]) {
  const uid = await currentUserId();
  if (uid) {
    const { error } = await supabase.from('shared_finds').delete().eq('user_id', uid);
    if (error) throw error;
  }
  for (const find of finds) if (find.sharedId && getFind(find.id)) await updateFind(find.id, { sharedId: undefined });
}

export async function fetchShared(bounds: Bounds, limit = 500): Promise<SharedFind[]> {
  const query = (west: number, east: number) =>
    supabase
      .from('shared_finds')
      .select('id, user_id, latitude, longitude, place, found_at')
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', west)
      .lte('longitude', east)
      .order('created_at', { ascending: false })
      .limit(limit);
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
};

/** Where the sender is: city name plus a point the server rounds to 0.1° (≈11 km). */
export type Place = { city?: string; lat?: number; lng?: number };

/** A new letter, or with `parent` a relay of a letter I received (the server keeps its card and message). */
export async function sendLuckyLetter(messageKey: number, cardKey: number, place?: Place, parent?: string) {
  await myUserId();
  const { error } = await supabase.rpc('send_lucky_letter', {
    p_message: messageKey,
    p_card: cardKey,
    p_origin: place?.city ?? null,
    p_lat: place?.lat ?? null,
    p_lng: place?.lng ?? null,
    p_parent: parent ?? null,
  });
  if (error) throw error;
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
};

export async function myLetters(): Promise<KeptLetter[]> {
  await myUserId();
  const { data, error } = await supabase.rpc('my_letters');
  if (error) throw error;
  return (data ?? []) as KeptLetter[];
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
  await myUserId();
  const { data, error } = await supabase.rpc('my_journeys');
  if (error) throw error;
  return ((data ?? []) as Journey[]).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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
