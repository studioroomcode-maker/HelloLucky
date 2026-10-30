import { cropClover } from './cloverCrop';
import type { FractionBox } from './detector/tiles';
import { addFind, getSettings, updateFind } from './findsStore';
import { captureLocation } from './location';

/** Saves a camera photo as a find (with the spot, if allowed, and a clover close-up around `box`) and returns its id. */
export async function saveCapture(photoPath: string, aiDetected: boolean, box?: FractionBox): Promise<string> {
  // A bare path on native; already a URI (file:, or blob: in the Toss web bundle) otherwise.
  const tempPhotoUri = /^[a-z]+:/.test(photoPath) ? photoPath : `file://${photoPath}`;
  const [location, clover] = await Promise.all([
    getSettings().saveLocation ? captureLocation() : null,
    // The close-up is a nicety: a failed crop still saves the find.
    box ? cropClover(tempPhotoUri, box).catch((error) => void console.warn('capture: clover crop failed', error)) : undefined,
  ]);
  const find = await addFind({
    tempPhotoUri,
    tempCloverUri: clover?.uri,
    cloverBox: clover && box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined,
    photoAspect: clover?.aspect,
    aiDetected,
    latitude: location?.latitude,
    longitude: location?.longitude,
  });
  // Place names are a nicety; resolve after saving so capture never waits on the network.
  location?.place
    .then((geo) => (geo?.place ? updateFind(find.id, { place: geo.place, city: geo.city }) : undefined))
    .catch(() => {});
  return find.id;
}
