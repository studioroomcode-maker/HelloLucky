import { addFind, getSettings, updateFind } from './findsStore';
import { captureLocation } from './location';

/** Saves a camera photo as a find (with the spot, if allowed) and returns its id. */
export async function saveCapture(photoPath: string, aiDetected: boolean): Promise<string> {
  const tempPhotoUri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;
  const location = getSettings().saveLocation ? await captureLocation() : null;
  const find = await addFind({ tempPhotoUri, aiDetected, latitude: location?.latitude, longitude: location?.longitude });
  // Place names are a nicety; resolve after saving so capture never waits on the network.
  location?.place
    .then((geo) => (geo?.place ? updateFind(find.id, { place: geo.place, city: geo.city }) : undefined))
    .catch(() => {});
  return find.id;
}
