import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cheerKey, flagEmoji, letterMessage, myPlace, passportStamps, randomKey, routeCities } from '../src/letters.ts';

const s = {
  fortunes: Array.from({ length: 50 }, (_, i) => `f${i}`),
  cheers: Array.from({ length: 5 }, (_, t) => Array.from({ length: 10 }, (_, n) => `c${t}-${n}`)),
};

test('letter keys map to fortunes and cheers', () => {
  assert.equal(letterMessage(s, 0), 'f0');
  assert.equal(letterMessage(s, 49), 'f49');
  assert.equal(cheerKey(1, 3), 1013);
  assert.equal(letterMessage(s, 1013), 'c1-3');
  assert.equal(letterMessage(s, 1049), 'c4-9');
  assert.equal(letterMessage(s, 1099), 'f0', 'unknown cheer falls back');
});

test('random keys stay inside their topic and the server range', () => {
  for (let i = 0; i < 200; i++) {
    const f = randomKey(s, -1);
    assert.ok(f >= 0 && f <= 49);
    const c = randomKey(s, 2, 1025);
    assert.ok(c >= 1020 && c <= 1029 && c !== 1025);
  }
});

test('route cities merge repeats and mark unknown stops', () => {
  assert.deepEqual(routeCities([{ c: 'Seoul' }, { c: 'Seoul' }, {}, { c: 'Busan', la: 35.2, lo: 129.1 }]), ['Seoul', '?', 'Busan']);
  assert.deepEqual(routeCities([]), []);
});

test('my place is the newest find with a city', () => {
  const finds = [
    { createdAt: '2026-10-01T00:00:00Z', city: 'Seoul', latitude: 37.5, longitude: 127 },
    { createdAt: '2026-10-03T00:00:00Z' },
    { createdAt: '2026-10-02T00:00:00Z', city: 'Busan' },
  ];
  assert.deepEqual(myPlace(finds), { city: 'Busan', lat: undefined, lng: undefined });
  assert.equal(myPlace([]), undefined);
});

test('passport stamps one city once, counts later passes, numbers by first arrival', () => {
  const journeys = [
    { route: [{ c: 'Tokyo' }, { c: 'Seoul' }, { c: 'Seoul' }], card_key: 2, updated_at: '2026-10-05T00:00:00Z' },
    { route: [{ c: 'Seoul' }, {}, { c: 'Paris' }], card_key: 1, updated_at: '2026-10-01T00:00:00Z' },
  ];
  assert.deepEqual(passportStamps(journeys), [
    { city: 'Seoul', visits: 2, card: 1, n: 1 },
    { city: 'Paris', visits: 1, card: 1, n: 2 },
    { city: 'Tokyo', visits: 1, card: 2, n: 3 },
  ]);
  assert.deepEqual(passportStamps([]), []);
});

test('a stamp keeps the first known point of its city', () => {
  const [seoul] = passportStamps([
    { route: [{ c: 'Seoul' }, { c: 'Seoul', la: 37.6, lo: 127 }], card_key: 0, updated_at: '2026-10-01T00:00:00Z' },
    { route: [{ c: 'Seoul', la: 37.5, lo: 126.9 }], card_key: 0, updated_at: '2026-10-02T00:00:00Z' },
  ]);
  assert.deepEqual(seoul, { city: 'Seoul', visits: 2, card: 0, n: 1, la: 37.6, lo: 127 });
});

test('country codes become flag emoji', () => {
  assert.equal(flagEmoji('KR'), '🇰🇷');
  assert.equal(flagEmoji('jp'), '🇯🇵');
  assert.equal(flagEmoji(undefined), '');
  assert.equal(flagEmoji('KOR'), '');
});
