/**
 * On-device journal of four-leaf finds. Everything lives in the app's
 * document directory: photos in finds/, metadata in one JSON file.
 * shortcut: whole-file JSON rewrite per change, fine for hundreds of finds; move to SQLite if users keep thousands.
 */
import { useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

export type Find = {
  id: string;
  createdAt: string;
  /** Absolute file:// URI of the photo inside the app sandbox. */
  photoUri: string;
  /** Square close-up of the clover cut around the AI box (src/services/cloverCrop.ts); absent without a box. */
  cloverUri?: string;
  latitude?: number;
  longitude?: number;
  place?: string;
  /** City only (no district/street), used as the origin of lucky letters. */
  city?: string;
  note: string;
  /** True when the on-device AI had a stable lock at capture time. */
  aiDetected: boolean;
  /** Row id on the shared map while this find is shared. */
  sharedId?: string;
  /** Random seed for the fortune-cookie line (src/fortune.ts), fixed at capture. */
  fortune?: number;
};

export type Settings = {
  onboarded: boolean;
  saveLocation: boolean;
  /** Version of the Lucky Map notice the user accepted (MAP_RULES: 2 = spot + clover close-up). */
  mapRules: number;
  /** Lucky Map pins hidden after reporting them, and people whose pins are hidden (map ⋯ menu). */
  hiddenPins: string[];
  blockedUsers: string[];
  /** Times the user sent luck (share sheet completed); feeds the courier badge. */
  sentLuck: number;
  /** Lucky letters opened from strangers; feeds the recv* badges. */
  receivedLuck: number;
  /** Letters passed on, thank-you stickers received / sent, and letters of mine that came home (badges). */
  relayed: number;
  thanksGot: number;
  thanksGiven: number;
  homecomings: number;
  /** Day (dayStamp) the "on this day" memory was closed, and the day the special-day shower last ran. */
  memoryClosed: string;
  rainShown: string;
  /** Badges already celebrated, so each pops up once. */
  seenBadges: string[];
  /** Appearance; the app is designed light-first. */
  theme: 'light' | 'dark' | 'system';
};

type Data = { version: 1; finds: Find[]; settings: Settings };

const ROOT = FileSystem.documentDirectory ?? '';
const DATA_FILE = `${ROOT}hellolucky.json`;
const PHOTO_DIR = `${ROOT}finds/`;
const DEFAULT_SETTINGS: Settings = { onboarded: false, saveLocation: true, mapRules: 0, hiddenPins: [], blockedUsers: [], sentLuck: 0, receivedLuck: 0, relayed: 0, thanksGot: 0, thanksGiven: 0, homecomings: 0, memoryClosed: '', rainShown: '', seenBadges: [], theme: 'light' };

let data: Data = { version: 1, finds: [], settings: DEFAULT_SETTINGS };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function persist(next: Data) {
  // Write to a temp file then move, so a crash mid-write never corrupts the journal.
  const tmp = `${DATA_FILE}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(next));
  // iOS moveAsync refuses to overwrite; loadStore() falls back to the tmp file if we die in between.
  await FileSystem.deleteAsync(DATA_FILE, { idempotent: true });
  await FileSystem.moveAsync({ from: tmp, to: DATA_FILE });
  data = next;
  emit();
}

/** Current Lucky Map notice; a higher number asks again before the next pin (1.0's `sharingAgreed` was version 1). */
export const MAP_RULES = 2;

export function parseData(raw: string): Data {
  const parsed = JSON.parse(raw);
  return {
    version: 1,
    // iOS moves the app container on updates, so rebuild photo paths from the file name.
    finds: Array.isArray(parsed?.finds)
      ? parsed.finds.map((find: Find) => ({
          ...find,
          photoUri: `${PHOTO_DIR}${String(find.photoUri ?? '').split('/').pop()}`,
          cloverUri: find.cloverUri ? `${PHOTO_DIR}${find.cloverUri.split('/').pop()}` : undefined,
        }))
      : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed?.settings ?? {}) },
  };
}

export async function loadStore() {
  if (loaded) return;
  try {
    for (const file of [DATA_FILE, `${DATA_FILE}.tmp`]) {
      if ((await FileSystem.getInfoAsync(file)).exists) {
        data = parseData(await FileSystem.readAsStringAsync(file));
        break;
      }
    }
  } catch (error) {
    // A corrupt file must not brick the app; keep a copy so finds can be recovered.
    console.warn('findsStore: could not read journal', error);
    await FileSystem.copyAsync({ from: DATA_FILE, to: `${DATA_FILE}.corrupt-${Date.now()}` }).catch(() => {});
  }
  loaded = true;
  emit();
}

export function isStoreLoaded() {
  return loaded;
}

export function useFinds() {
  return useSyncExternalStore(subscribe, () => data.finds);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => data.settings);
}

export function useStoreLoaded() {
  return useSyncExternalStore(subscribe, () => loaded);
}

export function getSettings() {
  return data.settings;
}

export function getFind(id: string) {
  return data.finds.find((find) => find.id === id);
}

export async function addFind(
  input: Omit<Find, 'id' | 'createdAt' | 'photoUri' | 'cloverUri' | 'note'> & { tempPhotoUri: string; tempCloverUri?: string },
) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  const photoUri = `${PHOTO_DIR}${id}.jpg`;
  await FileSystem.copyAsync({ from: input.tempPhotoUri, to: photoUri });
  const cloverUri = input.tempCloverUri ? `${PHOTO_DIR}${id}-clover.jpg` : undefined;
  if (input.tempCloverUri && cloverUri) await FileSystem.copyAsync({ from: input.tempCloverUri, to: cloverUri });
  const { tempPhotoUri: _ignored, tempCloverUri: _ignoredClover, ...rest } = input;
  const find: Find = {
    ...rest,
    id,
    photoUri,
    cloverUri,
    note: '',
    createdAt: new Date().toISOString(),
    fortune: Math.floor(Math.random() * 1_000_000),
  };
  await persist({ ...data, finds: [find, ...data.finds] });
  return find;
}

export async function updateFind(id: string, patch: Partial<Pick<Find, 'note' | 'place' | 'city' | 'sharedId'>>) {
  await persist({
    ...data,
    finds: data.finds.map((find) => (find.id === id ? { ...find, ...patch } : find)),
  });
}

export async function deleteFind(id: string) {
  const find = getFind(id);
  await persist({ ...data, finds: data.finds.filter((item) => item.id !== id) });
  if (find) await FileSystem.deleteAsync(find.photoUri, { idempotent: true });
  if (find?.cloverUri) await FileSystem.deleteAsync(find.cloverUri, { idempotent: true });
}

export async function deleteAllFinds() {
  await persist({ ...data, finds: [] });
  await FileSystem.deleteAsync(PHOTO_DIR, { idempotent: true });
}

export async function updateSettings(patch: Partial<Settings>) {
  await persist({ ...data, settings: { ...data.settings, ...patch } });
}

type Counter = 'sentLuck' | 'receivedLuck' | 'relayed' | 'thanksGot' | 'thanksGiven' | 'homecomings';

/** Adds to badge counters from the latest saved values (callbacks may hold stale settings). */
export async function bumpCounters(add: Partial<Record<Counter, number>>) {
  const next = { ...data.settings };
  for (const [key, n] of Object.entries(add) as [Counter, number][]) next[key] = (next[key] ?? 0) + n;
  await persist({ ...data, settings: next });
}
