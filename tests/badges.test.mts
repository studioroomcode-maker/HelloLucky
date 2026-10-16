import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BADGES, BADGE_FAMILIES, badgeText, earnedBadges, longestStreak } from '../src/badges.ts';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const none = { sentLuck: 0, receivedLuck: 0, fortunes: 50 };

test('500 unique badges, half of them hidden', () => {
  assert.equal(BADGES.length, 500);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 500);
  assert.equal(BADGES.filter((b) => b.hidden).length, 250);
});

// "Don't hand them out early": a first day earns only a few, however busy.
test('a first day earns only a couple of badges', () => {
  const t0 = new Date(2026, 9, 17, 14, 0).getTime();
  const find = (min: number, extra = {}) => ({ createdAt: new Date(t0 + min * 60_000).toISOString(), aiDetected: true, latitude: 37.55, longitude: 126.84, city: 'Seoul', ...extra });
  const typical = earnedBadges([find(0), find(4)], none);
  assert.deepEqual([...typical].sort(), ['ai1', 'count1']);
  // Five finds in one patch, a note on each, one pinned, one letter sent.
  const busy = Array.from({ length: 5 }, (_, i) => find(i, { note: 'here', fortune: i, sharedId: i === 0 ? 'x' : undefined }));
  const got = earnedBadges(busy, { ...none, sentLuck: 1 });
  assert.ok(got.size <= 8, [...got].join(','));
  assert.ok([...got].every((id) => BADGES.findIndex((b) => b.id === id) < 100), 'no family tier on day one');
});

test('family badges unlock by tier and read their text from the family builder', () => {
  const days = Array.from({ length: 20 }, (_, i) => ({ createdAt: new Date(2026, 0, 1 + i * 2, 12).toISOString(), aiDetected: true }));
  const got = earnedBadges(days, none);
  assert.ok(got.has('days15') && got.has('days20') && !got.has('days25'));
  // Every other day from Jan 1: 16 January days, 4 in February, none in March.
  assert.ok(got.has('month1') && got.has('month2') && !got.has('month3'));
  const strings = {
    badges: { count1: { title: 'First', desc: 'one' } },
    badgeFamilies: Object.fromEntries(BADGE_FAMILIES.map((k) => [k, { title: (n: number) => `${k}:${n}`, desc: (n: number) => `d${n}` }])),
    hiddenTitle: '???',
    hiddenDesc: 'hidden',
  };
  assert.deepEqual(badgeText(strings, 'count1', false), { title: 'First', desc: 'one' });
  assert.deepEqual(badgeText(strings, 'days15', true), { title: 'days:15', desc: 'd15' });
  assert.equal(badgeText(strings, 'hour15', false).title, '???', 'hidden until earned');
});

test('streak counts consecutive local days, across a month boundary', () => {
  const days = [at(2026, 9, 29), at(2026, 9, 30), at(2026, 10, 1), at(2026, 10, 1, 18), at(2026, 10, 5)].map((s) => new Date(s));
  assert.equal(longestStreak(days), 3);
  assert.equal(longestStreak([]), 0);
});

test('badges follow the journal', () => {
  assert.equal(earnedBadges([], none).size, 0);
  const finds = [
    { createdAt: at(2026, 4, 4, 7, 7), aiDetected: true, latitude: 37.55, longitude: 126.84, city: 'Seoul', note: 'park', fortune: 3 },
    { createdAt: at(2026, 4, 4, 7, 7), aiDetected: true, latitude: 37.5501, longitude: 126.8401, city: 'Seoul', fortune: 4 },
    { createdAt: at(2026, 4, 5), aiDetected: true, latitude: 35.1, longitude: 129.04, city: 'Busan', sharedId: 'x', fortune: 53 },
    { createdAt: at(2026, 4, 6, 22), aiDetected: false, city: 'Daegu' },
  ];
  const got = earnedBadges(finds, { sentLuck: 1, receivedLuck: 1, fortunes: 50 });
  const expect = ['count1', 'count3', 'streak3', 'ai1', 'manual1', 'city3', 'km100', 'note1', 'pin1', 'send1', 'recv1',
    'spring', 'cloverDay', 'time707'];
  for (const id of expect) assert.ok(got.has(id), id);
  // Ambient and same-day badges need 3 different days: spring has Apr 4/5/6, the 7am pair is a single day.
  for (const id of ['count5', 'streak5', 'sameSpot', 'comeback', 'southern', 'fortune10', 'earlyBird', 'summer', 'double', 'quickPair'])
    assert.ok(!got.has(id), id);
});

test('same spot on different days and a long comeback', () => {
  const finds = [
    { createdAt: at(2026, 1, 1), aiDetected: true, latitude: 10, longitude: 10 },
    { createdAt: at(2026, 3, 1), aiDetected: true, latitude: 10.0001, longitude: 10.0001 },
    { createdAt: at(2026, 3, 2), aiDetected: true, latitude: -33.9, longitude: 151.2 },
  ];
  const got = earnedBadges(finds, none);
  for (const id of ['sameSpot', 'comeback', 'southern', 'newYear', 'km1000', 'km5000']) assert.ok(got.has(id), id);
});

test('luck pot grows through its stages', async () => {
  const { potStage } = await import('../src/pot.ts');
  assert.deepEqual(potStage(0), { stage: 0, toNext: 1 });
  assert.deepEqual(potStage(2), { stage: 1, toNext: 1 });
  assert.deepEqual(potStage(6), { stage: 3, toNext: 6 });
  assert.deepEqual(potStage(99), { stage: 5, toNext: 0 });
});
