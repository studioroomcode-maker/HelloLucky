import { test } from 'node:test';
import assert from 'node:assert/strict';

import { focalLength, integrate, motionAt } from '../src/services/detector/cameraMotion.ts';

test('focal length follows view size, field of view and zoom', () => {
  const f = focalLength(891, 76, 1);
  assert.ok(Math.abs(f - 891 / 2 / Math.tan((38 * Math.PI) / 180)) < 1e-6);
  assert.ok(Math.abs(focalLength(891, 76, 2) - 2 * f) < 1e-6);
});

test('a steady turn shifts the scene by focal × angle', () => {
  let s = { t: 0, x: 0, y: 0 };
  for (let t = 16; t <= 1000; t += 16) s = integrate(s, { x: 0, y: 0.5 }, t, 500); // 0.5 rad/s yaw for ~1 s
  assert.ok(Math.abs(s.x - 500 * 0.5 * 0.992) < 1, String(s.x));
  assert.equal(s.y, 0);
  assert.equal(integrate({ t: 0, x: 0, y: 0 }, { x: 1, y: 1 }, 5000, 500).x, 25, 'long gaps count as 50 ms at most');
});

test('motion at a past moment uses the latest sample before it', () => {
  const h = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 10, y: 1 }, { t: 200, x: 20, y: 2 }];
  assert.deepEqual(motionAt(h, 150), { x: 10, y: 1 });
  assert.deepEqual(motionAt(h, 500), { x: 20, y: 2 });
  assert.deepEqual(motionAt(h, -5), { x: 0, y: 0 });
  assert.deepEqual(motionAt([], 5), { x: 0, y: 0 });
});
