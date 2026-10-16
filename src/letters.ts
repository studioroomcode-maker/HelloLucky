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

/** One stop of a relay chain: city name and a 0.1°-rounded point (either may be missing). */
export type Hop = { c?: string; la?: number; lo?: number };

/** City names along a route, unknown stops as '?', repeats in a row merged. */
export function routeCities(route: readonly Hop[]): string[] {
  const names: string[] = [];
  for (const hop of route) {
    const name = hop.c?.trim() || '?';
    if (names[names.length - 1] !== name) names.push(name);
  }
  return names;
}

/** Where "I" am for a letter: the newest find that has a city. Rounded on the server to 0.1°. */
export function myPlace(finds: readonly { createdAt: string; city?: string; latitude?: number; longitude?: number }[]) {
  const f = [...finds].filter((x) => x.city).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return f ? { city: f.city!, lat: f.latitude, lng: f.longitude } : undefined;
}

