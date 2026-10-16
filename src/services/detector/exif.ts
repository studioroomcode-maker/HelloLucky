/**
 * Clockwise degrees that stand a JPEG upright, from its EXIF Orientation tag (0x0112).
 * Android camera files keep the sensor's landscape pixels and only record the rotation here.
 * Mirrored orientations (2, 4, 5, 7) never come from the back camera and count as their unmirrored turn.
 */
export function exifRotation(bytes: Uint8Array): 0 | 90 | 180 | 270 {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0; // not a JPEG
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return 0;
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && String.fromCharCode(...bytes.slice(i + 4, i + 8)) === 'Exif') {
      const tiff = i + 10;
      const little = bytes[tiff] === 0x49; // 'II'
      const u16 = (o: number) => (little ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o: number) => (little ? u16(o) | (u16(o + 2) << 16) : (u16(o) << 16) | u16(o + 2)) >>> 0;
      const ifd = tiff + u32(tiff + 4);
      const count = u16(ifd);
      for (let e = 0; e < count; e++) {
        const entry = ifd + 2 + e * 12;
        if (entry + 10 > bytes.length) return 0;
        if (u16(entry) === 0x0112) {
          const value = u16(entry + 8);
          return value === 6 || value === 5 ? 90 : value === 3 || value === 4 ? 180 : value === 8 || value === 7 ? 270 : 0;
        }
      }
      return 0;
    }
    if (marker === 0xda) return 0; // image data started: no EXIF
    i += 2 + length;
  }
  return 0;
}
