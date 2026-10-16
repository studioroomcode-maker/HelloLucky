import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fitView, landDots, project, shortRoute } from '../src/journeyMap.ts';

const SEOUL = { la: 37.6, lo: 127.0 };
const BUSAN = { la: 35.2, lo: 129.1 };
const TOKYO = { la: 35.7, lo: 139.7 };
const SYDNEY = { la: -33.9, lo: 151.2 };

test('the view holds every stop with a margin and keeps the aspect', () => {
  for (const route of [[SEOUL], [SEOUL, BUSAN], [SEOUL, TOKYO, SYDNEY]]) {
    const v = fitView(route, 1.6);
    assert.ok(Math.abs(v.spanLon / v.spanLat - 1.6) < 1e-9);
    for (const p of route) {
      const { x, y } = project(v, p);
      assert.ok(x > 0.05 && x < 0.95 && y > 0.05 && y < 0.95, JSON.stringify({ p, x, y }));
    }
  }
  assert.ok(fitView([SEOUL, BUSAN], 1.6).spanLon >= 36, 'short trips still show the coastline');
});

test('land dots fall on land: Korea has dots, the open Pacific has none', () => {
  const v = fitView([SEOUL, BUSAN], 1.6);
  const { dots } = landDots(v);
  const near = (p: { x: number; y: number }) => dots.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < 0.03);
  assert.ok(near(project(v, { la: 36.5, lo: 127.8 })), 'Korean peninsula');
  const pacific = fitView([{ la: 0, lo: -150 }], 1.6);
  assert.equal(landDots(pacific).dots.length, 0);
  assert.ok(landDots(fitView([], 1.6)).dots.length > 300, 'whole world');
});

test('long routes keep the start and the latest stops', () => {
  assert.deepEqual(shortRoute(['A', 'B', 'C']), ['A', 'B', 'C']);
  assert.deepEqual(shortRoute(['A', 'B', 'C', 'D', 'E', 'F']), ['A', 'B', '…', 'E', 'F']);
});
