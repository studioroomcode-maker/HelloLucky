import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BADGE_FAMILIES } from '../src/badges.ts';
import { decodeYolo } from '../src/services/detector/yoloDecode.ts';
import { modelBoxToUpright, projectToView, uprightRotation, uprightSize } from '../src/services/detector/frameMapping.ts';
import { advanceDetectionTracker, createDetectionTrackerState } from '../src/services/detectionTracker.ts';

const N = 8400;
const cfg = {
  numAnchors: N,
  numClasses: 1,
  inputSize: 640,
  coordsAreNormalized: true,
  minConfidence: 0.45,
  iouThreshold: 0.45,
  maxBoxes: 5,
  keepClassIndex: 0,
};

function output(anchors: { i: number; cx: number; cy: number; w: number; h: number; s: number }[]) {
  const out = new Float32Array(5 * N);
  for (const a of anchors) {
    out[a.i] = a.cx;
    out[N + a.i] = a.cy;
    out[2 * N + a.i] = a.w;
    out[3 * N + a.i] = a.h;
    out[4 * N + a.i] = a.s;
  }
  return out;
}

test('decodeYolo keeps confident boxes, scales to pixels and applies NMS', () => {
  const boxes = decodeYolo(
    output([
      { i: 10, cx: 0.5, cy: 0.5, w: 0.1, h: 0.1, s: 0.9 },
      { i: 11, cx: 0.505, cy: 0.5, w: 0.1, h: 0.1, s: 0.8 }, // overlaps the first → suppressed
      { i: 500, cx: 0.2, cy: 0.3, w: 0.05, h: 0.05, s: 0.6 },
      { i: 900, cx: 0.8, cy: 0.8, w: 0.05, h: 0.05, s: 0.3 }, // below threshold
    ]),
    cfg,
  );
  assert.equal(boxes.length, 2);
  assert.equal(boxes[0].x, 320);
  assert.ok(Math.abs(boxes[0].width - 64) < 1e-3);
  assert.ok(Math.abs(boxes[1].y - 192) < 1e-3);
});

test('orientation → clockwise upright rotation (Android back camera reports landscape-right)', () => {
  assert.equal(uprightRotation('portrait'), 0);
  assert.equal(uprightRotation('landscape-right'), 90);
  assert.equal(uprightRotation('portrait-upside-down'), 180);
  assert.equal(uprightRotation('landscape-left'), 270);
  assert.deepEqual(uprightSize(1920, 1080, 90), { width: 1080, height: 1920 });
});

test('model box maps through center crop and rotation', () => {
  const box = { x: 0, y: 0, width: 64, height: 32, confidence: 1 };
  // 1920x1080 raw frame → 1080 square crop starting at x=420. Model (0,0) → raw (420,0).
  const r0 = modelBoxToUpright(box, 1920, 1080, 0, 640);
  assert.equal(r0.x, 420);
  assert.equal(r0.y, 0);
  assert.ok(Math.abs(r0.width - 108) < 1e-9);
  // Rotated 90° CW, raw top-left becomes the upright top-right.
  const r90 = modelBoxToUpright(box, 1920, 1080, 90, 640);
  assert.equal(r90.x, 1080);
  assert.equal(r90.y, 420);
  assert.ok(Math.abs(r90.width - 54) < 1e-9 && Math.abs(r90.height - 108) < 1e-9);
  // Frame center stays at the upright center for every rotation.
  const center = { x: 320, y: 320, width: 10, height: 10, confidence: 1 };
  for (const rot of [0, 90, 180, 270] as const) {
    const m = modelBoxToUpright(center, 1920, 1080, rot, 640);
    const size = uprightSize(1920, 1080, rot);
    assert.equal(m.x, size.width / 2);
    assert.equal(m.y, size.height / 2);
  }
});

test('projectToView matches resizeMode cover', () => {
  // 1080x1920 frame on a 390x844 view: scale by height, crop sides.
  const rect = projectToView({ x: 540, y: 960, width: 108, height: 108, confidence: 1 }, 1080, 1920, 390, 844);
  const scale = 844 / 1920;
  assert.ok(Math.abs(rect.width - 108 * scale) < 1e-9);
  assert.ok(Math.abs(rect.left + rect.width / 2 - 195) < 1e-9);
  assert.ok(Math.abs(rect.top + rect.height / 2 - 422) < 1e-9);
});

test('tracker locks after the required streak and drops stale tracks', () => {
  const config = { requiredStreak: 3, minLockConfidence: 0.5, maxMissedFrames: 1, iouThreshold: 0.2, smoothingFactor: 0.5, maxTracks: 5 };
  const det = { x: 100, y: 100, width: 40, height: 40, confidence: 0.8 };
  let state = createDetectionTrackerState();
  let snap = advanceDetectionTracker(state, [det], config);
  assert.equal(snap.candidateTracks.length, 1);
  state = snap.state;
  snap = advanceDetectionTracker(state, [{ ...det, x: 104 }], config);
  state = snap.state;
  assert.equal(snap.stableTracks.length, 0);
  snap = advanceDetectionTracker(state, [{ ...det, x: 106 }], config);
  state = snap.state;
  assert.equal(snap.stableTracks.length, 1);
  snap = advanceDetectionTracker(state, [], config);
  state = snap.state;
  assert.equal(snap.tracks.length, 0, 'missed frame hides the track');
  snap = advanceDetectionTracker(state, [], config);
  assert.equal(snap.state.tracks.length, 0, 'second miss removes it');
  // One dropped frame pauses the streak: hit, hit, miss, hit locks at requiredStreak 3.
  state = createDetectionTrackerState();
  for (const frame of [[det], [det], [], [det]]) {
    snap = advanceDetectionTracker(state, frame, config);
    state = snap.state;
  }
  assert.equal(snap.stableTracks.length, 1, 'a single miss does not restart the streak');
  // A steady but unsure box stays a candidate.
  state = createDetectionTrackerState();
  for (let i = 0; i < 5; i++) {
    snap = advanceDetectionTracker(state, [{ ...det, confidence: 0.4 }], config);
    state = snap.state;
  }
  assert.equal(snap.stableTracks.length, 0);
  assert.equal(snap.candidateTracks.length, 1);
});

test('every language has the same fortunes, pot stages and badges', async () => {
  const files = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'id', 'vi', 'th'];
  for (const file of files) {
    const mod = await import(`../src/i18n/${file}.ts`);
    const s = Object.values(mod)[0] as { fortunes: string[]; potStages: string[]; badges: object; cheerTopics: string[]; cheers: string[][] };
    assert.equal(s.fortunes.length, 50, file);
    // Letter keys travel between users, so every language needs the same cheer grid (src/letters.ts).
    assert.equal(s.cheerTopics.length, 5, file);
    assert.deepEqual(s.cheers.map((topic) => topic.length), [10, 10, 10, 10, 10], file);
    assert.ok(s.cheers.flat().every((line) => line.trim().length > 0), file);
    // Every tiered badge family needs a title/desc builder that yields real text.
    const fams = (s as unknown as { badgeFamilies: Record<string, { title: (n: number) => string; desc: (n: number) => string }> }).badgeFamilies;
    for (const key of BADGE_FAMILIES) {
      assert.ok(fams?.[key], `${file}: ${key}`);
      const ns = key === 'month' ? [1, 12] : key === 'hour' ? [0, 23] : key === 'wday' ? [0, 6] : [1, 2, 5, 22, 100];
      for (const n of ns) assert.ok(fams[key].title(n).trim() && fams[key].desc(n).trim() && !/undefined/.test(fams[key].title(n) + fams[key].desc(n)), `${file}: ${key}(${n})`);
    }
    assert.equal(s.potStages.length, 6, file);
    assert.equal(Object.keys(s.badges).length, 97, file); // 100 minus the night-time badges
  }
});
