import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeBoxes, tilePlan } from '../src/services/detector/tiles.ts';

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
