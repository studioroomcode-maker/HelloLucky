import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryOfToday, specialDay } from '../src/warm.ts';

test('special days by local date', () => {
  assert.equal(specialDay(new Date(2027, 3, 4, 9)), 'cloverDay');
  assert.equal(specialDay(new Date(2027, 2, 17, 23, 59)), 'patrick');
  assert.equal(specialDay(new Date(2027, 0, 1, 0, 1)), 'newYear');
  assert.equal(specialDay(new Date(2027, 3, 5)), undefined);
});

test('on this day picks the most recent earlier year, never today', () => {
  const at = (y: number, m: number, d: number) => ({ createdAt: new Date(y, m - 1, d, 15).toISOString(), id: `${y}` });
  const finds = [at(2024, 10, 17), at(2026, 10, 17), at(2027, 10, 17), at(2025, 10, 16)];
  const got = memoryOfToday(finds, new Date(2027, 9, 17, 20));
  assert.equal(got?.find.id, '2026');
  assert.equal(got?.years, 1);
  assert.equal(memoryOfToday(finds, new Date(2027, 9, 18)), undefined);
  assert.equal(memoryOfToday([at(2027, 10, 17)], new Date(2027, 9, 17)), undefined, 'a find from today is not a memory');
});
