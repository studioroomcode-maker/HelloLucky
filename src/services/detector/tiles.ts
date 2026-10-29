import type { CloverDetectionBox } from '../detectionTracker';

export type Tile = { x: number; y: number };

/**
 * Square tiles of `size` that cover a width × height image with at least `overlap` (0–1) between neighbours,
 * so a clover cut by one tile edge is whole in the next. Images smaller than a tile get a single tile at 0.
 */
export function tilePlan(width: number, height: number, size: number, overlap = 0.15): Tile[] {
  const starts = (length: number) => {
    if (length <= size) return [0];
    const count = Math.ceil((length - size) / (size * (1 - overlap))) + 1;
    const step = (length - size) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(i * step));
  };
  return starts(height).flatMap((y) => starts(width).map((x) => ({ x, y })));
}

type Raw = { buffer: ArrayBuffer; width: number; height: number; pixelFormat: string };

/**
 * Raw image bytes (any 3/4-channel order) → the model's float32 RGB 0–1 input, size × size.
 * Edge tiles smaller than `size` are padded with YOLOX's letterbox grey (114).
 */
export function toModelInput(raw: Raw, size: number): Float32Array {
  const order = raw.pixelFormat.toUpperCase();
  const bpp = order.length;
  if (bpp !== 3 && bpp !== 4) throw new Error(`unsupported pixel format ${raw.pixelFormat}`);
  const [r, g, b] = ['R', 'G', 'B'].map((c) => order.indexOf(c));
  const bytes = new Uint8Array(raw.buffer);
  const stride = bytes.length / raw.height; // rows may be padded
  if (stride < raw.width * bpp) throw new Error('pixel buffer smaller than its size');
  const out = new Float32Array(size * size * 3).fill(114 / 255);
  for (let y = 0; y < Math.min(size, raw.height); y++) {
    for (let x = 0; x < Math.min(size, raw.width); x++) {
      const src = y * stride + x * bpp;
      const dst = (y * size + x) * 3;
      out[dst] = bytes[src + r] / 255;
      out[dst + 1] = bytes[src + g] / 255;
      out[dst + 2] = bytes[src + b] / 255;
    }
  }
  return out;
}

function iou(a: CloverDetectionBox, b: CloverDetectionBox) {
  const w = Math.min(a.x + a.width / 2, b.x + b.width / 2) - Math.max(a.x - a.width / 2, b.x - b.width / 2);
  const h = Math.min(a.y + a.height / 2, b.y + b.height / 2) - Math.max(a.y - a.height / 2, b.y - b.height / 2);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / (a.width * a.height + b.width * b.height - inter);
}

/** Greedy NMS across tiles: the same clover seen by two overlapping tiles becomes one box. */
export function mergeBoxes(boxes: CloverDetectionBox[], iouThreshold = 0.4): CloverDetectionBox[] {
  const kept: CloverDetectionBox[] = [];
  for (const box of [...boxes].sort((a, b) => b.confidence - a.confidence)) {
    if (kept.every((k) => iou(k, box) <= iouThreshold)) kept.push(box);
  }
  return kept;
}

/** A box as fractions (0–1) of the upright image, centre-based like the detector's. */
export type FractionBox = { x: number; y: number; width: number; height: number };

const clamp = (v: number, hi: number) => Math.round(Math.min(Math.max(v, 0), hi));

/**
 * Square close-up around a four-leaf: `pad`× the box's longer side (at least `minSide` of the short image side),
 * shifted to stay inside the image. The box comes from the photo itself, so the margin only frames the clover.
 */
export function cloverSquare(box: FractionBox, width: number, height: number, pad = 1.4, minSide = 0.08) {
  const short = Math.min(width, height);
  const side = Math.round(Math.min(short, Math.max(Math.max(box.width * width, box.height * height) * pad, short * minSide)));
  return { left: clamp(box.x * width - side / 2, width - side), top: clamp(box.y * height - side / 2, height - side), side };
}

/**
 * The detection that is the live lock: the nearest one within 2× the lock's longer side (the hand may move between
 * lock and shutter, but a clover farther off is a different one). Without a lock, the first (most confident).
 */
export function nearLive(found: FractionBox[], live: FractionBox | undefined, width: number, height: number) {
  if (!live) return found[0];
  const reach = 2 * Math.max(live.width * width, live.height * height);
  const distance = (b: FractionBox) => Math.hypot((b.x - live.x) * width, (b.y - live.y) * height);
  return found.filter((b) => distance(b) <= reach).sort((a, b) => distance(a) - distance(b))[0];
}

/**
 * The square of a photo the live detector looks at: the short side, like the frame's center crop, but centred on
 * `around` (the live lock) when given, so the clover is seen at the same scale it was locked at.
 */
export function photoWindow(width: number, height: number, around?: { x: number; y: number }) {
  const side = Math.min(width, height);
  const { x = 0.5, y = 0.5 } = around ?? {};
  return { left: clamp(x * width - side / 2, width - side), top: clamp(y * height - side / 2, height - side), side };
}
