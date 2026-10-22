import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cloverSquare, photoWindow } from '../src/services/detector/tiles.ts';

test('clover close-up is a padded square around the box, inside the image', () => {
  // 20% box in the middle of a 3024×4032 portrait photo → 1.4× its longer side (604.8 px).
  const mid = cloverSquare({ x: 0.5, y: 0.5, width: 0.2, height: 0.1 }, 3024, 4032);
  assert.deepEqual(mid, { left: 1089, top: 1593, side: 847 });
  for (const box of [
    { x: 0.02, y: 0.98, width: 0.1, height: 0.1 }, // corner: shifted inside
    { x: 0.5, y: 0.5, width: 0.9, height: 0.9 }, // huge: capped at the short side
    { x: 0.5, y: 0.5, width: 0.01, height: 0.01 }, // tiny: at least 8% of the short side
  ]) {
    const r = cloverSquare(box, 3024, 4032);
    assert.ok(r.left >= 0 && r.top >= 0 && r.left + r.side <= 3024 && r.top + r.side <= 4032, JSON.stringify({ box, r }));
    assert.ok(r.side >= Math.round(3024 * 0.08) && r.side <= 3024, JSON.stringify(r));
  }
});

test('photo check window is the short-side square, around the live lock, inside the photo', () => {
  assert.deepEqual(photoWindow(3024, 4032), { left: 0, top: 504, side: 3024 });
  assert.deepEqual(photoWindow(3024, 4032, { x: 0.3, y: 0.2 }), { left: 0, top: 0, side: 3024 });
  assert.deepEqual(photoWindow(3024, 4032, { x: 0.5, y: 0.6 }), { left: 0, top: 907, side: 3024 });
  assert.deepEqual(photoWindow(3024, 4032, { x: 0.5, y: 0.95 }), { left: 0, top: 1008, side: 3024 });
});
