import { imageFromBlob } from './nitroImage';

/**
 * A picked or Toss-camera photo as an upright, EXIF-free JPEG blob: URI. The browser applies EXIF when decoding,
 * so re-encoding here keeps wideScan's own EXIF turn from rotating the picture a second time.
 */
export async function uprightPhotoUri(blob: Blob) {
  return (await imageFromBlob(blob)).saveToTemporaryFileAsync('jpg', 92);
}

/** `data:` URI or bare base64 (what the Toss SDK returns) → Blob. */
export function dataUriToBlob(dataUri: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  const bin = atob(match ? match[3] : dataUri);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: match?.[1] || 'image/jpeg' });
}
