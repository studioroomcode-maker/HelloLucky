import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exifRotation } from '../src/services/detector/exif.ts';

/** A minimal JPEG start: SOI, an APP0 segment, then APP1 Exif with one IFD0 entry (Orientation). */
function jpeg(orientation: number, little: boolean) {
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (little ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const app0 = [0xff, 0xe0, 0, 4, 0, 0];
  return new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff, ...app1, 0xff, 0xda]);
}

test('EXIF orientation becomes clockwise degrees, both byte orders', () => {
  for (const little of [true, false]) {
    assert.equal(exifRotation(jpeg(1, little)), 0);
    assert.equal(exifRotation(jpeg(6, little)), 90);
    assert.equal(exifRotation(jpeg(3, little)), 180);
    assert.equal(exifRotation(jpeg(8, little)), 270);
  }
  assert.equal(exifRotation(new Uint8Array([0xff, 0xd8, 0xff, 0xda])), 0, 'no EXIF');
  assert.equal(exifRotation(new Uint8Array([0x89, 0x50])), 0, 'not a JPEG');
});
