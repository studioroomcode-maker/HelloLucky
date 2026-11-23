/**
 * Wide scan: one high-resolution photo, cut into overlapping 960 tiles and run through the same detector.
 * In a 12 MP photo taken 30–50 cm above a patch a four-leaf covers ~10–15% of a tile instead of the
 * 5–8% it gets in the live preview, which is where the live detector is weakest.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Images } from 'react-native-nitro-image';

import { DETECTOR } from '../../config/detector';
import type { CloverDetectionBox } from '../detectionTracker';
import { exifRotation } from './exif';
import { loadDetector, loadVerifier } from './model';
import {
  cloverSquare,
  mergeBoxes,
  nearLive,
  photoWindow,
  tilePlan,
  toModelInput,
  unrotateBox,
  type FractionBox,
} from './tiles';
import { decodeYolo } from './yoloDecode';

/** Photo is scaled to ~2/3 first: 4032×3024 → 12 tiles of 960, about 1–2 s on a recent phone. */
const SCALE = 2 / 3;
/** Max 1st-stage wide-scan candidates to re-verify on full-resolution 3× close-ups. */
const MAX_WIDE_VERIFY = 8;

type UprightImage = Awaited<ReturnType<typeof loadUpright>>;
type DetectorModel = Awaited<ReturnType<typeof loadDetector>>;

/** A candidate in the upright photo, as fractions (0–1) so any view size can draw it. */
export type WideCandidate = { x: number; y: number; width: number; height: number; confidence: number };

/** Candidates plus the exact upright image they were found in (shown and saved, so boxes always line up). */
export type WideResult = { candidates: WideCandidate[]; uri: string };

/** Reads just the JPEG header and returns the clockwise turn its EXIF asks for. */
export async function photoRotation(uri: string) {
  const head = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 65536 });
  return exifRotation(Uint8Array.from(globalThis.atob(head), (c) => c.charCodeAt(0)));
}

/** Loads a photo (path or file://) upright, as the user saw it. */
export async function loadUpright(path: string) {
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  const image = await Images.loadFromFileAsync(uri.replace(/^file:\/\//, ''));
  // The camera writes sensor-landscape pixels plus an EXIF turn; the decoder ignores EXIF, so apply it here.
  // With outputOrientation="preview" that turn always matches what the user saw on screen.
  const rotation = await photoRotation(uri);
  return rotation ? image.rotateAsync(rotation) : image;
}

/**
 * Stage-2 crop classifier: inspects a tight 1.5× close-up around `box` at 0° and 180°
 * and returns the mean P(four_leaf) in [0, 1]. Falls back to 0.5 if the verifier model is unavailable.
 */
async function verifyCrop(verifier: DetectorModel | undefined, image: UprightImage, box: FractionBox): Promise<number> {
  if (!verifier) return 0.5;
  try {
    const { inputSize, cropPad } = DETECTOR.verifier;
    const rect = cloverSquare(box, image.width, image.height, cropPad);
    const crop = await (await image.cropAsync(rect.left, rect.top, rect.left + rect.side, rect.top + rect.side)).resizeAsync(
      inputSize,
      inputSize,
    );
    const [out0] = await verifier.run([toModelInput(await crop.toRawPixelDataAsync(), inputSize).buffer as ArrayBuffer]);
    const rotated = await crop.rotateAsync(180);
    const [out180] = await verifier.run([toModelInput(await rotated.toRawPixelDataAsync(), inputSize).buffer as ArrayBuffer]);
    return (new Float32Array(out0)[0] + new Float32Array(out180)[0]) / 2;
  } catch (error) {
    console.warn('detector: verifier failed, falling back to stage-1 score', error);
    return 0.5;
  }
}

/**
 * Cooperative inspection of a square region:
 * 1) Runs the upright 0° view first (fast path).
 * 2) If 0° misses or is borderline (< minLockConfidence), checks 90° and 180° rotated views to rescue tilted clovers.
 * 3) Confirms if the detector is confident (>= minLockConfidence) and not vetoed by the Stage-2 verifier (>= minProbability),
 *    OR if a borderline detector hit (>= minConfidence) is rescued by the Stage-2 verifier (>= rescueProbability).
 */
async function inspectSquareCooperative(
  model: DetectorModel,
  verifier: DetectorModel | undefined,
  image: UprightImage,
  rect: { left: number; top: number; side: number },
  target?: FractionBox,
  reachFactor = 2.5,
  minReachFraction = 0.15,
): Promise<WideCandidate | undefined> {
  const { width, height } = image;
  const size = DETECTOR.inputSize;
  const k = rect.side / size;
  const square = await (await image.cropAsync(rect.left, rect.top, rect.left + rect.side, rect.top + rect.side)).resizeAsync(size, size);

  const runAngle = async (angle: 0 | 90 | 180) => {
    const view = angle ? await square.rotateAsync(angle) : square;
    const [output] = await model.run([toModelInput(await view.toRawPixelDataAsync(), size).buffer as ArrayBuffer]);
    const boxes = decodeYolo(new Float32Array(output), DETECTOR.decode)
      .map((b) => unrotateBox(b, size, angle))
      .map((b) => ({
        x: (rect.left + b.x * k) / width,
        y: (rect.top + b.y * k) / height,
        width: (b.width * k) / width,
        height: (b.height * k) / height,
        confidence: b.confidence,
      }));
    return nearLive(boxes, target, width, height, reachFactor, minReachFraction);
  };

  let best = await runAngle(0);
  if (!best || best.confidence < DETECTOR.tracker.minLockConfidence) {
    for (const angle of [90, 180] as const) {
      const candidate = await runAngle(angle);
      if (candidate && (!best || candidate.confidence > best.confidence)) {
        best = candidate;
      }
    }
  }
  if (!best) return undefined;

  const prob = await verifyCrop(verifier, image, best);
  const { minLockConfidence } = DETECTOR.tracker;
  const { minProbability, rescueProbability } = DETECTOR.verifier;
  if (best.confidence >= minLockConfidence && prob >= minProbability) return best;
  if (best.confidence >= DETECTOR.decode.minConfidence && prob >= rescueProbability) return best;
  return undefined;
}

/**
 * Second look at a shutter photo, so a find is judged on what was actually saved: a live lock can be a passing
 * false hit (grass flickering by while walking). Looks close up around the `live` lock first (3×, then 5× if the hand
 * shifted on shutter tap), then falls back to the live window, returning fractions or undefined.
 */
export async function findInPhoto(path: string, live?: FractionBox): Promise<FractionBox | undefined> {
  const [model, verifier, image] = await Promise.all([
    loadDetector(),
    loadVerifier().catch(() => undefined),
    loadUpright(path),
  ]);
  const { width, height } = image;
  const size = DETECTOR.inputSize;

  if (live) {
    const close3x = await inspectSquareCooperative(model, verifier, image, cloverSquare(live, width, height, 3), live, 3, 0.15);
    if (close3x) return close3x;
    const close5x = await inspectSquareCooperative(model, verifier, image, cloverSquare(live, width, height, 5), live, 3.5, 0.25);
    if (close5x) return close5x;
  }

  // Fallback: look at the wider square the live scanner saw (catches a hand that moved between lock and shutter),
  // then confirm that hit with a 3× close-up.
  const win = photoWindow(width, height, live);
  const square = await (await image.cropAsync(win.left, win.top, win.left + win.side, win.top + win.side)).resizeAsync(size, size);
  const [output] = await model.run([toModelInput(await square.toRawPixelDataAsync(), size).buffer as ArrayBuffer]);
  const k = win.side / size;
  const found = decodeYolo(new Float32Array(output), DETECTOR.decode).map((b) => ({
    x: (win.left + b.x * k) / width,
    y: (win.top + b.y * k) / height,
    width: (b.width * k) / width,
    height: (b.height * k) / height,
    confidence: b.confidence,
  }));
  const fallback = nearLive(found, live, width, height, 4, 0.35);
  if (!fallback) return undefined;
  const closeFallback = await inspectSquareCooperative(
    model,
    verifier,
    image,
    cloverSquare(fallback, width, height, 3),
    fallback,
    2.5,
    0.18,
  );
  if (closeFallback) return closeFallback;
  if (
    fallback.confidence >= DETECTOR.tracker.minLockConfidence &&
    (await verifyCrop(verifier, image, fallback)) >= DETECTOR.verifier.minProbability
  ) {
    return fallback;
  }
  return undefined;
}

export async function wideScan(path: string, onProgress: (done: number, total: number) => void): Promise<WideResult> {
  const [model, verifier, original] = await Promise.all([
    loadDetector(),
    loadVerifier().catch(() => undefined),
    loadUpright(path),
  ]);
  const image = await original.resizeAsync(Math.round(original.width * SCALE), Math.round(original.height * SCALE));
  const { width, height } = image;
  const saved = image.saveToTemporaryFileAsync('jpg', 92);
  const size = DETECTOR.inputSize;
  const tiles = tilePlan(width, height, size);

  const found: CloverDetectionBox[] = [];
  for (let i = 0; i < tiles.length; i++) {
    onProgress(i, tiles.length);
    const { x, y } = tiles[i];
    const tile = await image.cropAsync(x, y, Math.min(width, x + size), Math.min(height, y + size));
    const input = toModelInput(await tile.toRawPixelDataAsync(), size);
    const [output] = await model.run([input.buffer as ArrayBuffer]);
    for (const box of decodeYolo(new Float32Array(output), { ...DETECTOR.decode, maxBoxes: 20 })) {
      found.push({ ...box, x: box.x + x, y: box.y + y });
    }
  }

  // Stage 2: refine and verify top 1st-stage candidates on full-resolution 3× close-ups (rescuing borderline tile hits
  // and filtering only clear three-leaf false alarms).
  const coarse = mergeBoxes(found)
    .slice(0, MAX_WIDE_VERIFY)
    .map((b) => ({ x: b.x / width, y: b.y / height, width: b.width / width, height: b.height / height, confidence: b.confidence }));

  const verified: CloverDetectionBox[] = [];
  for (const cand of coarse) {
    const closeMatch = await inspectSquareCooperative(
      model,
      verifier,
      original,
      cloverSquare(cand, original.width, original.height, 3),
      cand,
      2.5,
      0.15,
    );
    if (closeMatch) {
      verified.push({
        x: closeMatch.x * width,
        y: closeMatch.y * height,
        width: closeMatch.width * width,
        height: closeMatch.height * height,
        confidence: Math.max(cand.confidence, closeMatch.confidence),
      });
    } else if (cand.confidence >= DETECTOR.tracker.minLockConfidence) {
      // Keep confident tile detections unless the Stage-2 verifier strongly vetoes them as three-leafs.
      const prob = await verifyCrop(verifier, original, cand);
      if (prob >= DETECTOR.verifier.minProbability) {
        verified.push({
          x: cand.x * width,
          y: cand.y * height,
          width: cand.width * width,
          height: cand.height * height,
          confidence: cand.confidence,
        });
      }
    }
  }

  onProgress(tiles.length, tiles.length);
  const candidates = mergeBoxes(verified).map((b) => ({
    x: b.x / width,
    y: b.y / height,
    width: b.width / width,
    height: b.height / height,
    confidence: b.confidence,
  }));
  const file = await saved;
  return { candidates, uri: file.startsWith('file://') ? file : `file://${file}` };
}
