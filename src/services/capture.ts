import { cropClover } from './cloverCrop';
import type { FractionBox } from './detector/tiles';
import { addFind, getSettings, updateFind } from './findsStore';
import { captureLocation } from './location';

/** Saves a camera photo as a find (with the spot, if allowed, and a clover close-up around `box`) and returns its id. */
export async function saveCapture(photoPath: string, aiDetected: boolean, box?: FractionBox): Promise<string> {
  const tempPhotoUri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;
  const [location, tempCloverUri] = await Promise.all([
    getSettings().saveLocation ? captureLocation() : null,
    // The close-up is a nicety: a failed crop still saves the find.
    box ? cropClover(tempPhotoUri, box).catch((error) => void console.warn('capture: clover crop failed', error)) : undefined,
  ]);
  const find = await addFind({
    tempPhotoUri,
    tempCloverUri: tempCloverUri ?? undefined,
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
