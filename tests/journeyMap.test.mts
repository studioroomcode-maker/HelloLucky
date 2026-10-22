import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fitView, greatCirclePoint, landDots, paintCells, project, quadLength, quadPoint } from '../src/journeyMap.ts';

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

test('a leg starts and ends on its stops and is longer than the straight line', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };
  const c = { x: 50, y: -40 };
  assert.deepEqual(quadPoint(a, c, b, 0), a);
  assert.deepEqual(quadPoint(a, c, b, 1), b);
  assert.deepEqual(quadPoint(a, c, b, 0.5), { x: 50, y: -20 });
  const full = quadLength(a, c, b);
  assert.ok(full > 100 && full < 140);
  assert.ok(Math.abs(quadLength(a, c, b, 0.5) - full / 2) < 0.5, 'symmetric leg: half way is half the length');
  assert.equal(quadLength(a, { x: 50, y: 0 }, b), 100);
});

test('a growing map line follows the great circle between stops', () => {
  const near = (p: { la: number; lo: number }, q: { la: number; lo: number }) => Math.abs(p.la - q.la) < 1e-6 && Math.abs(p.lo - q.lo) < 1e-6;
  assert.ok(near(greatCirclePoint({ la: 0, lo: 0 }, { la: 0, lo: 90 }, 0.5), { la: 0, lo: 45 }));
  assert.ok(near(greatCirclePoint(SEOUL, TOKYO, 0), SEOUL));
  assert.ok(near(greatCirclePoint(SEOUL, TOKYO, 1), TOKYO));
  // Seoul → New York bows north over the pole side, well above both cities' latitudes.
  assert.ok(greatCirclePoint(SEOUL, { la: 40.7, lo: -74.0 }, 0.5).la > 60);
  assert.deepEqual(greatCirclePoint(SEOUL, SEOUL, 0.5), SEOUL);
});

test('each city paints the land dot it sits on, once', () => {
  const view = fitView([], 1.75);
  const { dots, step } = landDots(view, 60);
  const cells = paintCells(view, dots, step, [SEOUL, { la: 37.5, lo: 127.1 }, SYDNEY, { la: 0, lo: -150 }]);
  assert.equal(cells.length, 3, 'two Seoul points share one cell');
  assert.deepEqual(cells.map((c) => c.i), [0, 2, 3]);
  for (const c of cells.slice(0, 2)) assert.ok(dots.some((d) => d.x === c.x && d.y === c.y), 'cities land on land dots');
  const sea = project(view, { la: 0, lo: -150 });
  assert.deepEqual({ x: cells[2].x, y: cells[2].y }, sea, 'mid-ocean stays where it is');
});

test('a trip around the world keeps all of North America on the map', () => {
  const NEW_YORK = { la: 40.7, lo: -74.0 };
  const RIO = { la: -22.9, lo: -43.2 };
  const v = fitView([SEOUL, NEW_YORK, RIO, SYDNEY], 1.75);
  assert.ok(Math.abs(v.spanLon / v.spanLat - 1.75) < 1e-9);
  for (const p of [{ la: 34.1, lo: -118.2 }, { la: 49.3, lo: -123.1 }, { la: 61.2, lo: -149.9 }, SEOUL, SYDNEY]) {
    const { x, y } = project(v, p);
    assert.ok(x > 0 && x < 1 && y > 0 && y < 1, JSON.stringify({ p, x, y }));
  }
  const { dots } = landDots(v);
  const la = project(v, { la: 39.7, lo: -105 });
  assert.ok(dots.some((d) => Math.hypot(d.x - la.x, d.y - la.y) < 0.03), 'Denver has land around it');
});
