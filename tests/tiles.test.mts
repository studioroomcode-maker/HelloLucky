import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeBoxes, nearLive, tilePlan, ttaConsensus, unrotateBox } from '../src/services/detector/tiles.ts';

test('tiles cover the whole image with overlap and stay inside it', () => {
  for (const [w, h] of [[2016, 2688], [1512, 2016], [960, 960], [3024, 4032]]) {
    const tiles = tilePlan(w, h, 960, 0.15);
    for (const t of tiles) assert.ok(t.x >= 0 && t.y >= 0 && t.x + 960 <= w && t.y + 960 <= h, `${w}x${h} ${JSON.stringify(t)}`);
    // Every pixel is inside some tile.
    for (let y = 0; y < h; y += 37) for (let x = 0; x < w; x += 37) assert.ok(tiles.some((t) => x >= t.x && x < t.x + 960 && y >= t.y && y < t.y + 960));
    // Neighbours overlap by at least 15%.
    const xs = [...new Set(tiles.map((t) => t.x))];
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] <= 960 * 0.85 + 1);
  }
  assert.equal(tilePlan(2016, 2688, 960).length, 12); // 3 × 4 with 15% overlap
  assert.deepEqual(tilePlan(500, 400, 960), [{ x: 0, y: 0 }]);
});

test('boxes seen by two tiles merge into one', () => {
  const merged = mergeBoxes([
    { x: 100, y: 100, width: 50, height: 50, confidence: 0.6 },
    { x: 104, y: 102, width: 48, height: 50, confidence: 0.8 },
    { x: 400, y: 400, width: 50, height: 50, confidence: 0.5 },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].confidence, 0.8);
});

test('raw pixels in any channel order become RGB 0–1, padded with grey', async () => {
  const { toModelInput } = await import('../src/services/detector/tiles.ts');
  // 2×1 BGRA image: pure red, pure blue.
  const bgra = new Uint8Array([0, 0, 255, 255, 255, 0, 0, 255]).buffer;
  const out = toModelInput({ buffer: bgra, width: 2, height: 1, pixelFormat: 'BGRA' }, 3);
  assert.deepEqual([...out.slice(0, 6)], [1, 0, 0, 0, 0, 1]);
  assert.ok(Math.abs(out[out.length - 1] - 114 / 255) < 1e-6, 'padding is letterbox grey');
  const rgb = toModelInput({ buffer: new Uint8Array([255, 128, 0]).buffer, width: 1, height: 1, pixelFormat: 'RGB' }, 1);
  assert.deepEqual([...rgb].map((v) => Math.round(v * 255)), [255, 128, 0]);
  assert.throws(() => toModelInput({ buffer: new ArrayBuffer(4), width: 1, height: 1, pixelFormat: 'unknown' }, 1));
});

test('the photo check keeps only the clover near the live lock', () => {
  const live = { x: 0.5, y: 0.5, width: 0.05, height: 0.05 }; // 200 px on a 4000 × 3000 photo → reach 400 px
  const near = { x: 0.55, y: 0.5, width: 0.05, height: 0.05 }; // 200 px off
  const far = { x: 0.7, y: 0.5, width: 0.05, height: 0.05 }; // 800 px off: a different clover
  assert.equal(nearLive([far, near], live, 4000, 3000), near);
  assert.equal(nearLive([far], live, 4000, 3000), undefined);
  assert.equal(nearLive([far, near], undefined, 4000, 3000), far); // no lock: most confident
});

test('unrotateBox maps rotated square detections back to upright coordinates', () => {
  const size = 960;
  // Original box at (200, 100), w=80, h=40.
  // 90° CW: (size - 100, 200) = (860, 200), w=40, h=80.
  assert.deepEqual(unrotateBox({ x: 860, y: 200, width: 40, height: 80, confidence: 0.7 }, size, 90), {
    x: 200,
    y: 100,
    width: 80,
    height: 40,
    confidence: 0.7,
  });
  // 180°: (760, 860), w=80, h=40.
  assert.deepEqual(unrotateBox({ x: 760, y: 860, width: 80, height: 40, confidence: 0.7 }, size, 180), {
    x: 200,
    y: 100,
    width: 80,
    height: 40,
    confidence: 0.7,
  });
  // 270° CW: (100, 760), w=40, h=80.
  assert.deepEqual(unrotateBox({ x: 100, y: 760, width: 40, height: 80, confidence: 0.7 }, size, 270), {
    x: 200,
    y: 100,
    width: 80,
    height: 40,
    confidence: 0.7,
  });
});

test('ttaConsensus keeps clusters agreed on by at least minVotes distinct views', () => {
  const v0 = [
    { x: 480, y: 480, width: 100, height: 100, confidence: 0.6 },
    { x: 100, y: 100, width: 60, height: 60, confidence: 0.8 }, // one-view false hit
  ];
  const v90 = [{ x: 484, y: 478, width: 102, height: 98, confidence: 0.5 }];
  const v180: typeof v0 = [];
  const res = ttaConsensus([v0, v90, v180], 2, 0.35);
  assert.equal(res.length, 1);
  assert.equal(res[0].x, 482);
  assert.equal(res[0].y, 479);
  assert.ok(Math.abs(res[0].confidence - 0.55) < 1e-9);
});
