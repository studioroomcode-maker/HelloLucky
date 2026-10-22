/**
 * Geometry for the journey card's dot map (equirectangular, so 1° is the same size both ways).
 * Pure functions: the app card (src/ui/JourneyCard.tsx) and the design mockups draw from the same numbers.
 */
// Land mask at 1° (Natural Earth 110m land, public domain): 360 × 144 cells from 180°W, 84°N down to -60°S,
// row-major, 1 bit per cell, base64. Generated once; drawn as a dot map below.
export const WORLD = { width: 360, height: 144, north: 84, west: -180, bits: 'AAAAAAAAAAAAAAAAAAAAAAAH/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADf//8AAf///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB////D//////n/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gf/x////////wAAAAAbgAAB4AAAAAAPwAAAAAAAAAAAAAAAAAAAAAAAAAAAf//8A///////+AAAAB/ngAAAAAAAAAAH8AAAAAAAAAAAAAAAAAAAAAAAAcH3Hv/5////////8AAAAA/gAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAcIAAQP/AH///////+AAAAAPCAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAADwDAc+f+AP///////4AAAAAAAAAAAAAB4AAAAB/8AAAAAAAAAAAAAAAAAAAAAH9wc374AAAf/////8AAAAAAAAAAAAH4AAAA////AAAB/gAAAAAAAAAAAAAAAAwAAA/QAAAH/////8AAAAAAAAAAAAOAAAAP///wAAAAAAAAAAAAAAAAAAAAP8AYe+c3AAAD/////4AAAAAAAAAAAA4AAAH////++HgAOAAAAAAAAAAAAAAAfv+4+w/4gAAB/////wAAAAAAAAAAADwAHgH///////4AfgAAAAAgAAAAAAAAPf/4O4//9AAB/////wAAAAAAAAAAADwAPb////////4m//gAAAAAAAf+AAAAAA/+A8f//4AB////8gAAAAAAA/gAAAAAfv/////////////8AAAAAB///+H//H/+PeDwf+AA3////AAAAAAA//4AAAA8fv///////////////P8gAf////////A4CPz4H8AAP///wAAAAAAD///wADH/n3/////////////////8AD////////////34Z/wA///4AAAAAAAP///+M////n/////////////////+4E/////////////gD/8Af//gAAAAAAAf//5+P////f/////////////////fw/////////////6AD8YAf/wAAf8AAAA/8f+D///////////////////////AgEf///////////zw7/AAP/gAAP4AAAB/4/+f//////////////////////8AMAf//////////+DIA/gAH/gAAAAAAAH/z/////////////////////////+AAH///////////8AwgOAAD+AAAAAAAA//H/////////////////////////6AAP///////////wAA/AAAB+AAAAAAAB/+H//////////////////////nP+AAAH//z////////wAA/wAAAOAAAAAAAB//D/////////////////////+A/4AAAA/zAD///////gAA/4wAAAAAAAAAAB//Ab///////////////////+eDgAAAAABwAA///////4AA/94AAAAAAAAAYA5+A///////////////////4AAHAAAAAADcAAD//////4AAf/8AAAAAAAAA8AC+C///////////////////wAAfgAAAAAMAAAA///////wAf/8AAAAAAAAA4AO8H///////////////////AAA/gAAAABgAAAA///////8A///AAAAAAAAA8ANwH//////////////////8AAB/AAAAAEAAAAAf///////z///4AAAAAAAHOAEDv//////////////////+AAA+AAAAAAAAAABH///////x///8AAAAAAAHHAf/////////////////////6AA8AAAAAAAAAAAD///////x///8AAAAAAAGPz//////////////////////6AAwAAAAAAAAAAAD///////9///6AAAAAAAAPj//////////////////////6AAQAAAAAAAAAAAC///////////MAAAAAAAAYf//////////////////////7AAAAAAAAAAAAAABv////////+MNAAAAAAAAD///////////////////////zAAAAAAAAAAAAAAAH////////7gfgAAAAAAAf///////////////////////yAAAAAAAAAAAAAAAL/////////gCgAAAAAAAH///////////////////////iAAAAAAAAAAAAAAAP/////////pAAAAAAAAAD/////uP////////////////DAAAAAAAAAAAAAAAP/////////+AAAAAAAAAB//v//Gf///////////////+AAAAAAAAAAAAAAAAP////////8wAAAAAAAAAB//H/+AP///////////////8CAAAAAAAAAAAAAAAP////////wAAAAAAAAADj/jz/8AD///////////////4HgAAAAAAAAAAAAAAP////////gAAAAAAAAAH/4Bw/8AA//////////////+APAAAAAAAAAAAAAAAP////////gAAAAAAAAAH/wA8f8Ph//////////////8AAAAAAAAAAAAAAAAAP///////8AAAAAAAAAAH/gMHfJ///////////////v4AMAAAAAAAAAAAAAAAP///////8AAAAAAAAAAH/AMCOP//////////////+JwAMAAAAAAAAAAAAAAAH///////4AAAAAAAAAAH/AAAHH//////////////8BwAIAAAAAAAAAAAAAAAH///////wAAAAAAAAAAH+AAYGH//////////////+w4A4AAAAAAAAAAAAAAAD///////wAAAAAAAAAAAgf+ACBs//////////////g4D4AAAAAAAAAAAAAAAB///////wAAAAAAAAAAAj/+AAAA//////////////AYf4AAAAAAAAAAAAAAAA///////gAAAAAAAAAAB//8AAAA//////////////Ah2AAAAAAAAAAAAAAAAAP/////+AAAAAAAAAAAD//+AAAB//////////////gDwAAAAAAAAAAAAAAAAAH/////8AAAAAAAAAAAH///4GAB//////////////gDAAAAAAAAAAAAAAAAAAG/////4AAAAAAAAAAAP///8P4h//////////////wCAAAAAAAAAAAAAAAAAACf////4AAAAAAAAAAAP////v////////////////gAAAAAAAAAAAAAAAAAAABP//hgYAAAAAAAAAAAP//////3//P///////////wAAAAAAAAAAAAAAAAAAAAv//AAYAAAAAAAAAAAf//////9//H///////////wAAAAAAAAAAAAAAAAAAAB3/+AAcAAAAAAAAAAB///////4//h///////////gAAAAAAAAAAAAAAAAAAAAR/+AANAAAAAAAAAAD///////8//wH//////////AAAAAAAAAAAAAAAAAAAAAJ/+AAEAAAAAAAAAAH///////+f/0B/////////+AAAAAAAAAAAAAAAAAAAAAI/8AAAAAAAAAAAAAH///////+f/44Af///////+QAAAAAAAAAAAAAAAAAAAAAf8AAAAAAAAAAAAAP////////H//+AP///////4gAAAAAAAAAAAAAAAAAAAAAP8AAuAAAAAAAAAAP////////H///AD///v///ggAAAAAAAAAAAAAAAAAAAAAH+AABgAAAAAAAAAf////////n//+AD//4P//YAAAAAAAAAAAAAAAAAAAAAAAP+A4AYAAAAAAAAAP////////j//+AAf/4H/+AAAAAAAAAAAAAAAAgAAAAAAAH/B4ABwAAAAAAAAP////////h//8AAf/gD/8YAAAAAAAAAAAAAAAAAAAAAAAD/nwAD9AAAAAAAAP////////x//4AAf/AD/8QAAAAAAAAAAAAAAAAAAAAAAAAf/wAAAAAAAAAAAP////////4//gAAf+AD/+AAwAAAAAAAAAAAAAAAAAAAAAAH/wAAAAAAAAAAAf////////4f+AAAf8AD//AAwAAAAAAAAAAAAAAAAAAAAAAAH/AAAAAAAAAAAf////////8f8AAAPwAAP/gAwAAAAAAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAf////////+fgAAAPwAAP/gAwAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAf/////////eAAAAHwAAP/gAMAAAAAAAAAAAAAAAAAAAAAAAAHgAAAAAAAAAAf/////////gAAAAHwAAM/gACAAAAAAAAAAAAAAAAAAAAAAAADABAAAAAAAAAP/////////gYAAADwAAEfgAJAAAAAAAAAAAAAAAAAAAAAAAADgPfKAAAAAAAH/////////34AAADwAAIOABAAAAAAAAAAAAAAAAAAAAAAAAAAyPf+AAAAAAAD//////////4AAADoAAIEACBAAAAAAAAAAAAAAAAAAAAAAAAA8///AAAAAAAB//////////wAAABIAAMAAAFAAAAAAAAAAAAAAAAAAAAAAAAAE///gAAAAAAB//////////wAAAAMAAEAAALgAAAAAAAAAAAAAAAAAAAAAAAAAf//wAAAAAAAf/////////gAAAAMAADAAMCAAAAAAAAAAAAAAAAAAAAAAAAAA////gAAAAAAP/B///////gAAAAAAADgAOAAAAAAAAAAAAAAAAAAAAAAAAAAAf///wAAAAAACAA///////AAAAAAAAxgA+AAAAAAAAAAAAAAAAAAAAAAAAAAAf///4AAAAAAAAAD/////+AAAAAAAAZgB4AAAAAAAAAAAAAAAAAAAAAAAAAAB////4AAAAAAAAAD/////8AAAAAAAAMwH8AAAAAAAAAAAAAAAAAAAAAAAAAAB////8AAAAAAAAAH/////4AAAAAAAAHQf8AIAAAAAAAAAAAAAAAAAAAAAAAAD////8AAAAAAAAAH/////gAAAAAAAAHgf88IAAAAAAAAAAAAAAAAAAAAAAAAD////+AAAAAAAAAH/////AAAAAAAAADwf8AAgAAAAAAAAAAAAAAAAAAAAAAAH/////4AAAAAAAAH/////AAAAAAAAABwP5wBwAAAAAAAAAAAAAAAAAAAAAAAH/////6AAAAAAAAD////+AAAAAAAAAB8P5wATwAAAAAAAAAAAAAAAAAAAAAAD//////4AAAAAAAB////8AAAAAAAAAA8AxQif+AAAAAAAAAAAAAAAAAAAAAAH//////8AAAAAAAB////4AAAAAAAAAAcAAIAD/gAAAAAAAAAAAAAAAAAAAAAH///////gAAAAAAA////4AAAAAAAAAAMAAIAI/ywAAAAAAAAAAAAAAAAAAAAH///////gAAAAAAA////4AAAAAAAAAADgAAAI/8BAAAAAAAAAAAAAAAAAAAAD///////gAAAAAAAf///4AAAAAAAAAAB+AAAA/4AIAAAAAAAAAAAAAAAAAAAB///////gAAAAAAAf///4AAAAAAAAAAAAmogAOMAAAAAAAAAAAAAAAAAAAAAB///////AAAAAAAAf///8AAAAAAAAAAAABCAAAGADAAAAAAAAAAAAAAAAAAAA///////AAAAAAAAf///8AAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAf/////+AAAAAAAAP///8AAAAAAAAAAAAAAAgCAAAAAAAAAAAAAAAAAAAAAAAf/////8AAAAAAAAf///+AQAAAAAAAAAAAAB+CAAAAAAAAAAAAAAAAAAAAAAAP/////4AAAAAAAAf///+AQAAAAAAAAAAAAD8DAAAAAAAAAAAAAAAAAAAAAAAP/////4AAAAAAAA////+AwAAAAAAAAAAAA38DgAAAAAAAAAAAAAAAAAAAAAAH/////4AAAAAAAA////8BwAAAAAAAAAAAD/8DgAAAAAAAAAAAAAAAAAAAAAAB/////4AAAAAAAA////8PwAAAAAAAAAAAD//HwAABABAAAAAAAAAAAAAAAAAAf////4AAAAAAAA////wPgAAAAAAAAAAAP//3wAAAACAAAAAAAAAAAAAAAAAAP////wAAAAAAAA////APgAAAAAAAAAAAP///wAAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAf//+APgAAAAAAAAAAAf///4AAAAAAAAAAAAAAAAAAAAAAAP////wAAAAAAAAf//+APgAAAAAAAAAAD////+AAIAAAAAAAAAAAAAAAAAAAAP////gAAAAAAAAP//+AfAAAAAAAAAAAf////+AAEAAAAAAAAAAAAAAAAAAAAP////AAAAAAAAAP///AfAAAAAAAAAAA//////AAAAAAAAAAAAAAAAAAAAAAAP///4AAAAAAAAAP//+APAAAAAAAAAAA//////gAAAAAAAAAAAAAAAAAAAAAAf///gAAAAAAAAAH//+AOAAAAAAAAAAB//////wAAAAAAAAAAAAAAAAAAAAAAf///AAAAAAAAAAH//4AEAAAAAAAAAAA//////4AAAAAAAAAAAAAAAAAAAAAAf//+AAAAAAAAAAH//4AAAAAAAAAAAAB//////4AAAAAAAAAAAAAAAAAAAAAAf//+AAAAAAAAAAH//4AAAAAAAAAAAAA//////4AAAAAAAAAAAAAAAAAAAAAAf//+AAAAAAAAAAD//wAAAAAAAAAAAAAf/////8AAAAAAAAAAAAAAAAAAAAAAf//8AAAAAAAAAAB//gAAAAAAAAAAAAAf/////4AAAAAAAAAAAAAAAAAAAAAA///8AAAAAAAAAAB//gAAAAAAAAAAAAAf/////4AAAAAAAAAAAAAAAAAAAAAA///4AAAAAAAAAAA//AAAAAAAAAAAAAAP/////4AAAAAAAAAAAAAAAAAAAAAAf//wAAAAAAAAAAA/+AAAAAAAAAAAAAAP/AP//wAAAAAAAAAAAAAAAAAAAAAA///gAAAAAAAAAAA/4AAAAAAAAAAAAAAf8AG//gAAAAAAAAAAAAAAAAAAAAAA//3AAAAAAAAAAAAYAAAAAAAAAAAAAAAOAAF//gAAAAAAAAAAAAAAAAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//AAABAAAAAAAAAAAAAAAAAAB//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAgAAAAAAAAAAAAAAAAAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAQAAAAAAAAAAAAAAAAAB//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYAAAAcAAAAAAAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAD/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAADQAAAAAAAAAAAAAAAAAD/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAHAAAAAAAAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAOAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } as const;

export type LatLng = { la: number; lo: number };
export type MapView = { west: number; north: number; spanLon: number; spanLat: number };

const SOUTH = WORLD.north - WORLD.height;
let landBits: Uint8Array | undefined;

function land(col: number, row: number) {
  if (row < 0 || row >= WORLD.height) return false;
  landBits ??= Uint8Array.from(globalThis.atob(WORLD.bits), (c) => c.charCodeAt(0));
  const i = row * WORLD.width + (((col % WORLD.width) + WORLD.width) % WORLD.width);
  return (landBits[i >> 3] & (0x80 >> (i & 7))) !== 0;
}

/**
 * The part of the world to show: every stop with a margin, at least `minSpan`° wide so a short trip
 * (Seoul → Busan) still shows its coastline. A trip too wide for the map's land rows gets the whole world,
 * seamed in the Pacific so no continent is cut off the sides, with open sea above and below.
 */
export function fitView(points: LatLng[], aspect: number, minSpan = 36): MapView {
  if (!points.length) return { west: -170, north: 80, spanLon: 340, spanLat: 340 / aspect };
  const los = points.map((p) => p.lo);
  const las = points.map((p) => p.la);
  const cx = (Math.min(...los) + Math.max(...los)) / 2;
  const cy = (Math.min(...las) + Math.max(...las)) / 2;
  let spanLon = Math.max(minSpan, (Math.max(...los) - Math.min(...los)) * 1.5, (Math.max(...las) - Math.min(...las)) * 1.5 * aspect);
  spanLon = Math.min(spanLon, 360);
  const spanLat = spanLon / aspect;
  if (spanLat > WORLD.height) {
    const world = 360 / aspect;
    return { west: -170, north: WORLD.north + (world - WORLD.height) / 2, spanLon: 360, spanLat: world };
  }
  const north = Math.min(WORLD.north, Math.max(SOUTH + spanLat, cy + spanLat / 2));
  return { west: cx - spanLon / 2, north, spanLon, spanLat };
}

/** Land dots inside the view, about `across` per row, as fractions (0–1) of the map box plus a radius and the dot step (°). */
export function landDots(view: MapView, across = 54) {
  const step = Math.max(1, Math.round(view.spanLon / across));
  const dots: { x: number; y: number }[] = [];
  const top = Math.floor(WORLD.north - view.north);
  const left = Math.floor(view.west - WORLD.west);
  for (let row = top - (top % step); row < top + view.spanLat; row += step) {
    for (let col = left - (left % step); col < left + view.spanLon; col += step) {
      if (!land(col, row)) continue;
      const lon = WORLD.west + col + step / 2;
      const lat = WORLD.north - row - step / 2;
      const x = (lon - view.west) / view.spanLon;
      const y = (view.north - lat) / view.spanLat;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) dots.push({ x, y });
    }
  }
  return { dots, radius: (0.36 * step) / view.spanLon, step };
}

/**
 * The map cell each place paints, as fractions of the map box: the nearest land dot within `reach` dot steps
 * (so a coastal city still lands on land), else the place itself. `i` is the place that painted it first;
 * later places on the same cell are skipped.
 */
export function paintCells(view: MapView, dots: { x: number; y: number }[], step: number, places: LatLng[], reach = 2) {
  const cells: { x: number; y: number; i: number }[] = [];
  places.forEach((place, i) => {
    const p = project(view, place);
    let best = p;
    let bestDeg = reach * step;
    for (const d of dots) {
      const deg = Math.hypot((d.x - p.x) * view.spanLon, (d.y - p.y) * view.spanLat);
      if (deg <= bestDeg) {
        best = d;
        bestDeg = deg;
      }
    }
    if (!cells.some((c) => Math.abs(c.x - best.x) < 1e-9 && Math.abs(c.y - best.y) < 1e-9)) cells.push({ x: best.x, y: best.y, i });
  });
  return cells;
}

export function project(view: MapView, p: LatLng) {
  return { x: (p.lo - view.west) / view.spanLon, y: (view.north - p.la) / view.spanLat };
}

/** Quadratic control point bowing each leg upward, so a route reads as a flight path. */
export function arcControl(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: mx, y: my - Math.max(0.04, len * 0.3) };
}

type Point = { x: number; y: number };

/** The point `t` (0–1) along a leg a → b bowed through control c. Runs on the UI thread too. */
export function quadPoint(a: Point, c: Point, b: Point, t: number): Point {
  'worklet';
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Length of a leg from its start up to `t`, summed over short chords. */
export function quadLength(a: Point, c: Point, b: Point, t = 1, steps = 16): number {
  'worklet';
  let length = 0;
  let prev = a;
  for (let i = 1; i <= steps; i++) {
    const p = quadPoint(a, c, b, (t * i) / steps);
    length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return length;
}

/** Angle between two points seen from the earth's centre, in degrees (haversine). */
export function arcDegrees(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.la - a.la) * rad) / 2) ** 2 + Math.cos(a.la * rad) * Math.cos(b.la * rad) * Math.sin(((b.lo - a.lo) * rad) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / rad;
}

/** The point `t` (0–1) along the great circle from a to b, so a growing line follows the map's geodesic leg. */
export function greatCirclePoint(a: LatLng, b: LatLng, t: number): LatLng {
  const rad = Math.PI / 180;
  const [p1, l1, p2, l2] = [a.la * rad, a.lo * rad, b.la * rad, b.lo * rad];
  const d = arcDegrees(a, b) * rad;
  // Same place or exactly opposite sides of the earth: no single great circle, so go straight.
  if (Math.sin(d) < 1e-9) return { la: a.la + (b.la - a.la) * t, lo: a.lo + (b.lo - a.lo) * t };
  const wa = Math.sin((1 - t) * d) / Math.sin(d);
  const wb = Math.sin(t * d) / Math.sin(d);
  const x = wa * Math.cos(p1) * Math.cos(l1) + wb * Math.cos(p2) * Math.cos(l2);
  const y = wa * Math.cos(p1) * Math.sin(l1) + wb * Math.cos(p2) * Math.sin(l2);
  const z = wa * Math.sin(p1) + wb * Math.sin(p2);
  return { la: Math.atan2(z, Math.hypot(x, y)) / rad, lo: Math.atan2(y, x) / rad };
}
