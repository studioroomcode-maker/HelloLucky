import * as Location from 'expo-location';

const TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export function formatPlace(address: Location.LocationGeocodedAddress | undefined) {
  if (!address) return undefined;
  const parts = [address.city ?? address.subregion ?? address.region, address.district ?? address.street];
  const text = parts.filter((part, index) => part && parts.indexOf(part) === index).join(' ');
  return text || address.name || undefined;
}

/** City-level name only: the most a stranger ever sees of where a lucky letter came from. */
export function cityOf(address: Location.LocationGeocodedAddress | undefined) {
  return address?.city ?? address?.subregion ?? address?.region ?? undefined;
}

/**
 * Best-effort location for a new find. Never throws: a missing permission,
 * disabled GPS or a slow fix all just mean "saved without location".
 */
export async function captureLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position =
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), TIMEOUT_MS)) ??
      (await Location.getLastKnownPositionAsync());
    if (!position) return null;
    const { latitude, longitude } = position.coords;
    const place = Location.reverseGeocodeAsync({ latitude, longitude })
      .then((results) => ({ place: formatPlace(results[0]), city: cityOf(results[0]) }))
      .catch(() => undefined);
    return { latitude, longitude, place };
  } catch (error) {
    console.warn('location: unavailable', error);
    return null;
  }
}

const countries = new Map<string, Promise<string | undefined>>();

/**
 * ISO country code at a point, from the OS geocoder (cached per point). Never asks for permission or throws:
 * Android's geocoder needs location access already granted, so without it the answer is just undefined.
 */
export function countryCodeAt(latitude: number, longitude: number): Promise<string | undefined> {
  const key = `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
  let code = countries.get(key);
  if (!code) {
    code = withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), TIMEOUT_MS)
      .then((results) => results?.[0]?.isoCountryCode ?? undefined)
      .catch(() => undefined);
    // A miss (offline, no permission yet) is tried again next time.
    code.then((found) => found === undefined && countries.delete(key));
    countries.set(key, code);
  }
  return code;
}
