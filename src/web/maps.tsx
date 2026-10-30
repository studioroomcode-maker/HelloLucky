/**
 * Web stand-in for react-native-maps (metro.config.js aliases it on web only): Leaflet with raster tiles, covering the
 * props and camera calls app/map.tsx and app/journey/[chain].tsx use. Google Maps' SDK key is app-restricted, so
 * the web build can't use it.
 * shortcut: no mapPadding, user dot or snapshots (the journey video is native-only anyway).
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Asset } from 'expo-asset';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

// ⚠ Release: tile.openstreetmap.org's usage policy rules out app-scale traffic; pick a licensed provider (TOSS.md §8).
// No links in the attribution: a tap must not navigate the Toss WebView to another site.
const TILES = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxZoom: 19 };

export const PROVIDER_GOOGLE = 'google';

export type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
type Camera = { center: LatLng; zoom: number; heading?: number; pitch?: number };

type MapProps = {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  onMapReady?: () => void;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: () => void;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  children?: ReactNode;
};

export type MapView = {
  animateCamera(camera: Camera, options?: { duration?: number }): void;
  setCamera(camera: Camera): void;
  takeSnapshot(options?: unknown): Promise<string>;
};

const MapContext = createContext<L.Map | undefined>(undefined);

const ll = (p: LatLng): L.LatLngTuple => [p.latitude, p.longitude];

function regionOf(map: L.Map): Region {
  const b = map.getBounds();
  const c = map.getCenter();
  return { latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() };
}

const MapView = forwardRef<MapView, MapProps>(function MapView(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map>();
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const m = L.map(host.current!, { zoomControl: false, worldCopyJump: true });
    m.attributionControl.setPrefix(false);
    L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: TILES.maxZoom }).addTo(m);
    const r = latest.current.initialRegion;
    if (r) {
      m.fitBounds([
        [r.latitude - r.latitudeDelta / 2, r.longitude - r.longitudeDelta / 2],
        [r.latitude + r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2],
      ]);
    } else m.setView([30, 127], 2);
    m.on('moveend', () => latest.current.onRegionChangeComplete?.(regionOf(m)));
    m.on('click', () => latest.current.onPress?.());
    // The host View sizes itself after mount; Leaflet measures once, so measure again.
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current!);
    setMap(m);
    latest.current.onMapReady?.();
    return () => {
      resize.disconnect();
      m.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const pan = props.scrollEnabled !== false;
    const zoom = props.zoomEnabled !== false;
    for (const [handler, on] of [
      [map.dragging, pan],
      [map.touchZoom, zoom],
      [map.scrollWheelZoom, zoom],
      [map.doubleClickZoom, zoom],
    ] as const) {
      if (on) handler.enable();
      else handler.disable();
    }
  }, [map, props.scrollEnabled, props.zoomEnabled]);

  useImperativeHandle(
    ref,
    () => ({
      animateCamera: ({ center, zoom }, options) => map?.flyTo(ll(center), zoom, { duration: (options?.duration ?? 500) / 1000 }),
      setCamera: ({ center, zoom }) => map?.setView(ll(center), zoom, { animate: false }),
      takeSnapshot: () => Promise.reject(new Error('maps: no snapshots on web')),
    }),
    [map],
  );

  return (
    <View style={props.style}>
      <div ref={host} style={{ position: 'absolute', inset: 0, background: '#E8EFE6' }} />
      <MapContext.Provider value={map}>{props.children}</MapContext.Provider>
    </View>
  );
});

export default MapView;

type MarkerProps = {
  coordinate: LatLng;
  image?: number;
  anchor?: { x: number; y: number };
  title?: string;
  onPress?: (event: { stopPropagation(): void }) => void;
};

export function Marker({ coordinate, image, anchor, title, onPress }: MarkerProps) {
  const map = useContext(MapContext);
  const marker = useRef<L.Marker>(undefined);
  const press = useRef(onPress);
  press.current = onPress;

  useEffect(() => {
    if (!map) return;
    const asset = image === undefined ? undefined : Asset.fromModule(image);
    const size: L.PointTuple | undefined = asset?.width && asset.height ? [asset.width, asset.height] : undefined;
    const icon = asset
      ? L.icon({
          iconUrl: asset.uri,
          iconSize: size,
          iconAnchor: size ? [size[0] * (anchor?.x ?? 0.5), size[1] * (anchor?.y ?? 1)] : undefined,
        })
      : new L.Icon.Default();
    const m = L.marker([0, 0], { icon, title, keyboard: true }).addTo(map);
    m.on('click', () => press.current?.({ stopPropagation() {} }));
    marker.current = m;
    return () => {
      m.remove();
    };
  }, [map, image, anchor?.x, anchor?.y, title]);

  useEffect(() => {
    marker.current?.setLatLng(ll(coordinate));
  }, [map, image, coordinate.latitude, coordinate.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

type PolylineProps = { coordinates: LatLng[]; strokeColor?: string; strokeWidth?: number };

export function Polyline({ coordinates, strokeColor, strokeWidth }: PolylineProps) {
  const map = useContext(MapContext);
  const line = useRef<L.Polyline>(undefined);

  useEffect(() => {
    if (!map) return;
    const p = L.polyline([], { color: strokeColor, weight: strokeWidth, interactive: false }).addTo(map);
    line.current = p;
    return () => {
      p.remove();
    };
  }, [map, strokeColor, strokeWidth]);

  useEffect(() => {
    line.current?.setLatLngs(coordinates.map(ll));
  }, [map, strokeColor, strokeWidth, coordinates]);

  return null;
}
