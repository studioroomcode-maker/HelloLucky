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
import { mergeBoxes, tilePlan, toModelInput } from './tiles';
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

export async function wideScan(path: string, onProgress: (done: number, total: number) => void): Promise<WideResult> {
  const model = await loadDetector();
  const uri = path.startsWith('file://') ? path : `file://${path}`;
  let image = await Images.loadFromFileAsync(uri.replace(/^file:\/\//, ''));
  // The camera writes sensor-landscape pixels plus an EXIF turn; the decoder ignores EXIF, so apply it here.
  // With outputOrientation="preview" that turn always matches what the user saw on screen.
  const rotation = await photoRotation(uri);
  if (rotation) image = await image.rotateAsync(rotation);
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
  return { candidates, uri: file.startsWith('file://') ? file : `file://${file}` };
}
