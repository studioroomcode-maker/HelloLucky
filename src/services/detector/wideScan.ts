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
  ttaConsensus,
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
 * Runs 3-view rotation TTA (0°/90°/180°) on a square crop of `image` and returns detections
 * confirmed by at least `DETECTOR.tta.minVotes` views, in upright photo fractions (0–1).
 */
async function confirmSquareTta(
  model: DetectorModel,
  image: UprightImage,
  rect: { left: number; top: number; side: number },
): Promise<WideCandidate[]> {
  const { width, height } = image;
  const size = DETECTOR.inputSize;
  const square = await (await image.cropAsync(rect.left, rect.top, rect.left + rect.side, rect.top + rect.side)).resizeAsync(size, size);
  const views: CloverDetectionBox[][] = [];
  for (const angle of DETECTOR.tta.angles) {
    const view = angle ? await square.rotateAsync(angle) : square;
    const [output] = await model.run([toModelInput(await view.toRawPixelDataAsync(), size).buffer as ArrayBuffer]);
    const boxes = decodeYolo(new Float32Array(output), DETECTOR.decode)
      .filter((b) => b.confidence >= DETECTOR.tracker.minLockConfidence)
      .map((b) => unrotateBox(b, size, angle));
    views.push(boxes);
  }
  const k = rect.side / size;
  return ttaConsensus(views, DETECTOR.tta.minVotes, DETECTOR.tta.iouThreshold).map((b) => ({
    x: (rect.left + b.x * k) / width,
    y: (rect.top + b.y * k) / height,
    width: (b.width * k) / width,
    height: (b.height * k) / height,
    confidence: b.confidence,
  }));
}

/**
 * Stage-2 crop classifier: inspects a tight 1.5× close-up around `box` at 0° and 180°
 * and returns the mean P(four_leaf) in [0, 1].
 */
async function verifyCrop(verifier: DetectorModel, image: UprightImage, box: FractionBox): Promise<number> {
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
}

/**
 * Second look at a shutter photo, so a find is judged on what was actually saved: a live lock can be a passing
 * false hit (grass flickering by while walking). Looks close up around the `live` lock first with 3-view rotation TTA
 * and the Stage-2 crop verifier, then falls back to the live window, returning fractions or undefined.
 */
export async function findInPhoto(path: string, live?: FractionBox): Promise<FractionBox | undefined> {
  const [model, verifier, image] = await Promise.all([loadDetector(), loadVerifier(), loadUpright(path)]);
  const { width, height } = image;
  const size = DETECTOR.inputSize;

  const confirmCloseUp = async (target: FractionBox) => {
    const confirmed = await confirmSquareTta(model, image, cloverSquare(target, width, height, 3));
    const match = nearLive(confirmed, target, width, height);
    if (!match) return undefined;
    const prob = await verifyCrop(verifier, image, match);
    return prob >= DETECTOR.verifier.minProbability ? match : undefined;
  };

  if (live) {
    const closeMatch = await confirmCloseUp(live);
    if (closeMatch) return closeMatch;
  }

  // Fallback: look at the wider square the live scanner saw (catches a hand that moved between lock and shutter),
  // then confirm that hit with the same 3× rotation TTA + Stage-2 verifier close-up.
  const win = photoWindow(width, height, live);
  const square = await (await image.cropAsync(win.left, win.top, win.left + win.side, win.top + win.side)).resizeAsync(size, size);
  const [output] = await model.run([toModelInput(await square.toRawPixelDataAsync(), size).buffer as ArrayBuffer]);
  const k = win.side / size;
  const found = decodeYolo(new Float32Array(output), DETECTOR.decode)
    .filter((b) => b.confidence >= DETECTOR.tracker.minLockConfidence)
    .map((b) => ({
      x: (win.left + b.x * k) / width,
      y: (win.top + b.y * k) / height,
      width: (b.width * k) / width,
      height: (b.height * k) / height,
    }));
  const fallback = nearLive(found, live, width, height);
  return fallback ? confirmCloseUp(fallback) : undefined;
}

export async function wideScan(path: string, onProgress: (done: number, total: number) => void): Promise<WideResult> {
  const [model, verifier, original] = await Promise.all([loadDetector(), loadVerifier(), loadUpright(path)]);
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

  // Stage 2: re-verify top 1st-stage candidates on full-resolution 3× close-ups with rotation TTA + crop verifier.
  const coarse = mergeBoxes(found)
    .filter((b) => b.confidence >= DETECTOR.tracker.minLockConfidence)
    .slice(0, MAX_WIDE_VERIFY)
    .map((b) => ({ x: b.x / width, y: b.y / height, width: b.width / width, height: b.height / height, confidence: b.confidence }));

  const verified: CloverDetectionBox[] = [];
  for (const cand of coarse) {
    const confirmed = await confirmSquareTta(model, original, cloverSquare(cand, original.width, original.height, 3));
    const match = nearLive(confirmed, cand, original.width, original.height);
    if (match && (await verifyCrop(verifier, original, match)) >= DETECTOR.verifier.minProbability) {
      verified.push({
        x: match.x * width,
        y: match.y * height,
        width: match.width * width,
        height: match.height * height,
        confidence: match.confidence,
      });
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
