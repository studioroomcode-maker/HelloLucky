/**
 * Lucky-letter content keys (checked by supabase/lucky_letters.sql):
 *   0–49                 fortune lines (strings.fortunes)
 *   1000 + 10·topic + n  cheers, topic 0–4, n 0–9 (strings.cheers[topic][n])
 * Only the key travels, so every reader sees the message in their own language.
 */
export const CHEER_BASE = 1000;
export const CHEERS_PER_TOPIC = 10;

type LetterStrings = { fortunes: readonly string[]; cheers: readonly (readonly string[])[] };

export function cheerKey(topic: number, n: number) {
  return CHEER_BASE + topic * CHEERS_PER_TOPIC + n;
}

export function letterMessage(s: LetterStrings, key: number): string {
  if (key >= CHEER_BASE) {
    const k = key - CHEER_BASE;
    return s.cheers[Math.floor(k / CHEERS_PER_TOPIC)]?.[k % CHEERS_PER_TOPIC] ?? s.fortunes[0];
  }
  return s.fortunes[key % s.fortunes.length];
}

/** A random key for a topic: -1 = fortune lines, 0–4 = cheer topics. */
export function randomKey(s: LetterStrings, topic: number, avoid?: number): number {
  const size = topic < 0 ? s.fortunes.length : CHEERS_PER_TOPIC;
  let n = Math.floor(Math.random() * size);
  const key = (i: number) => (topic < 0 ? i : cheerKey(topic, i));
  if (key(n) === avoid && size > 1) n = (n + 1) % size;
  return key(n);
}

/** One stop of a relay chain: city name, a 0.1°-rounded point and the sender's name id (src/nicknames.ts); any may be missing. */
export type Hop = { c?: string; la?: number; lo?: number; n?: number };

/** City names along a route, unknown stops as '?', repeats in a row merged. */
export function routeCities(route: readonly Hop[]): string[] {
  const names: string[] = [];
  for (const hop of route) {
    const name = hop.c?.trim() || '?';
    if (names[names.length - 1] !== name) names.push(name);
  }
  return names;
}

/** A two-letter ISO country code as its flag emoji ('KR' → 🇰🇷); '' for anything else. */
export function flagEmoji(code?: string | null): string {
  const cc = code?.trim().toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Where "I" am for a letter: the newest find that has a city. Rounded on the server to 0.1°. */
export function myPlace(finds: readonly { createdAt: string; city?: string; latitude?: number; longitude?: number }[]) {
  const f = [...finds].filter((x) => x.city).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return f ? { city: f.city!, lat: f.latitude, lng: f.longitude } : undefined;
}

/** A passport stamp: a city my luck passed through, how many times, the card it first arrived on, and where it is. */
export type Stamp = { city: string; visits: number; card: number; n: number; la?: number; lo?: number };

/** One stamp per city along my journeys, numbered in the order they first appear (oldest journey first). */
export function passportStamps(journeys: readonly { route: readonly Hop[]; card_key: number; updated_at: string }[]): Stamp[] {
  const stamps = new Map<string, Stamp>();
  const locate = (stamp: Stamp, hop: Hop) => {
    if (stamp.la === undefined && typeof hop.la === 'number' && typeof hop.lo === 'number') {
      stamp.la = hop.la;
      stamp.lo = hop.lo;
    }
  };
  const oldestFirst = [...journeys].sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  for (const journey of oldestFirst) {
    let prev: string | undefined;
    // Same grouping as routeCities: repeats in a row are one pass through the city.
    for (const hop of journey.route) {
      const city = hop.c?.trim() || '?';
      const again = city === prev;
      prev = city;
      if (city === '?') continue;
      let stamp = stamps.get(city);
      if (!stamp) {
        stamp = { city, visits: 1, card: journey.card_key, n: stamps.size + 1 };
        stamps.set(city, stamp);
      } else if (!again) stamp.visits++;
      locate(stamp, hop);
    }
  }
  return [...stamps.values()];
}
