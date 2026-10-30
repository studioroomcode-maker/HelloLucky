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
import { loadDetector } from './model';
import { cloverSquare, mergeBoxes, nearLive, photoWindow, tilePlan, toModelInput, type FractionBox } from './tiles';
import { decodeYolo } from './yoloDecode';

/** Photo is scaled to ~2/3 first: 4032×3024 → 12 tiles of 960, about 1–2 s on a recent phone. */
const SCALE = 2 / 3;

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
  const uri = /^[a-z]+:/.test(path) ? path : `file://${path}`;
  const image = await Images.loadFromFileAsync(uri.replace(/^file:\/\//, ''));
  // The camera writes sensor-landscape pixels plus an EXIF turn; the decoder ignores EXIF, so apply it here.
  // With outputOrientation="preview" that turn always matches what the user saw on screen.
  const rotation = await photoRotation(uri);
  return rotation ? image.rotateAsync(rotation) : image;
}

/**
 * Second look at a shutter photo, so a find is judged on what was actually saved: a live lock can be a passing
 * false hit (grass flickering by while walking). Looks close up around the `live` lock first, then at the window
 * the live scanner saw, and returns the four-leaf it confirms as fractions of the upright photo, or undefined.
 */
export async function findInPhoto(path: string, live?: FractionBox): Promise<FractionBox | undefined> {
  const model = await loadDetector();
  const image = await loadUpright(path);
  const { width, height } = image;
  const size = DETECTOR.inputSize;
  const look = async ({ left, top, side }: { left: number; top: number; side: number }) => {
    const square = await (await image.cropAsync(left, top, left + side, top + side)).resizeAsync(size, size);
    const [output] = await model.run([toModelInput(await square.toRawPixelDataAsync(), size).buffer as ArrayBuffer]);
    const k = side / size;
    const found = decodeYolo(new Float32Array(output), DETECTOR.decode)
      .filter((b) => b.confidence >= DETECTOR.tracker.minLockConfidence)
      .map((b) => ({ x: (left + b.x * k) / width, y: (top + b.y * k) / height, width: (b.width * k) / width, height: (b.height * k) / height }));
    return nearLive(found, live, width, height);
  };
  // ~3× the lock puts the clover at ~30% of the input: in a paired eval (2026-10-29) that confirmed 56% of four-leafs
  // vs 22% at the live scale, with the same 3% three-leaf false rate. The wide window catches a hand that moved.
  return (live && (await look(cloverSquare(live, width, height, 3)))) ?? look(photoWindow(width, height, live));
}

export async function wideScan(path: string, onProgress: (done: number, total: number) => void): Promise<WideResult> {
  const model = await loadDetector();
  let image = await loadUpright(path);
  image = await image.resizeAsync(Math.round(image.width * SCALE), Math.round(image.height * SCALE));
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
  onProgress(tiles.length, tiles.length);
  const candidates = mergeBoxes(found)
    .filter((b) => b.confidence >= DETECTOR.tracker.minLockConfidence)
    .map((b) => ({ x: b.x / width, y: b.y / height, width: b.width / width, height: b.height / height, confidence: b.confidence }));
  const file = await saved;
  return { candidates, uri: /^[a-z]+:/.test(file) ? file : `file://${file}` };
}
