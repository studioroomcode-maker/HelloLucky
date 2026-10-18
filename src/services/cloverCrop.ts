/** The find's clover close-up: a small square cut from the photo around the AI box (journal thumbnails, Lucky Map). */
import { Images } from 'react-native-nitro-image';

import { photoRotation } from './detector/wideScan';
import { cloverSquare, type FractionBox } from './detector/tiles';

/** Output edge in px: sharp on a phone grid cell, ~40–80 KB as JPEG. */
const SIZE = 512;

/** Crops `photoUri` (file://, EXIF-rotated or upright) around `box` and returns a temp file:// JPEG. */
export async function cropClover(photoUri: string, box: FractionBox): Promise<string> {
  let image = await Images.loadFromFileAsync(photoUri.replace(/^file:\/\//, ''));
  // Boxes are in the upright view the user saw; camera files may still need their EXIF turn.
  const rotation = await photoRotation(photoUri);
  if (rotation) image = await image.rotateAsync(rotation);
  const { left, top, side } = cloverSquare(box, image.width, image.height);
  let crop = await image.cropAsync(left, top, left + side, top + side);
  if (side > SIZE) crop = await crop.resizeAsync(SIZE, SIZE);
  const file = await crop.saveToTemporaryFileAsync('jpg', 85);
  return file.startsWith('file://') ? file : `file://${file}`;
}
