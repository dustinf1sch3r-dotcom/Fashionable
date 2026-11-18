import type { CropRect } from './trim';

/** What a stroke does to the alpha mask. */
export type BrushMode = 'erase' | 'restore';
export type BrushSize = 's' | 'm' | 'l';

/** Brush diameter as a fraction of the photo's shorter side, so it feels the same at any size. */
export const BRUSH_DIAMETER: Readonly<Record<BrushSize, number>> = { s: 0.03, m: 0.06, l: 0.12 };
/** The soft rim of the brush, as a fraction of its radius (hard core inside). */
export const BRUSH_FEATHER = 0.35;
/** Distance between stamps along a stroke, as a fraction of the radius. */
export const BRUSH_SPACING = 0.25;
/** How many strokes can be undone. */
export const UNDO_LIMIT = 20;

export interface Point {
  x: number;
  y: number;
}

/** Brush radius in photo pixels. Never smaller than 2 px. */
export function brushRadius(size: BrushSize, width: number, height: number): number {
  return Math.max(2, (BRUSH_DIAMETER[size] * Math.min(width, height)) / 2);
}

/**
 * Stamps a round, soft-edged brush into a single-channel alpha mask (0..255, row-major, in
 * place). Erase scales alpha towards 0, restore moves it towards 255. Returns the pixels that
 * were touched, or `undefined` when the stamp lies completely outside the mask.
 */
export function stampBrush(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  mode: BrushMode,
): CropRect | undefined {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(width, Math.ceil(cx + radius));
  const y1 = Math.min(height, Math.ceil(cy + radius));
  if (x1 <= x0 || y1 <= y0 || radius <= 0) return undefined;
  const feather = Math.max(1, radius * BRUSH_FEATHER);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cover = Math.min(1, Math.max(0, (radius - d) / feather));
      if (cover === 0) continue;
      const i = y * width + x;
      const a = alpha[i];
      alpha[i] = mode === 'erase' ? a * (1 - cover) : a + (255 - a) * cover;
    }
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * The stamp positions that draw a continuous line from `from` (exclusive) to `to` (inclusive),
 * at most `spacing` apart. Without `from` (the first sample of a stroke) it is just `[to]`, so
 * a tap leaves a dot.
 */
export function strokePoints(from: Point | undefined, to: Point, spacing: number): Point[] {
  if (!from) return [to];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(0.5, spacing);
  const n = Math.floor(dist / step);
  const points: Point[] = [];
  for (let k = 1; k <= n; k++) {
    const t = (k * step) / dist;
    points.push({ x: from.x + dx * t, y: from.y + dy * t });
  }
  if (dist === 0 || n * step < dist) points.push(to);
  return points;
}

/** The smallest rectangle holding both; `a` may be missing. */
export function unionRect(a: CropRect | undefined, b: CropRect): CropRect {
  if (!a) return b;
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.width, b.x + b.width);
  const y1 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** A rectangle of mask values, enough to put a stroke back the way it was. */
export interface AlphaPatch extends CropRect {
  data: Uint8ClampedArray;
}

/** Copies the `rect` part of a mask that is `width` wide. */
export function capturePatch(alpha: Uint8ClampedArray, width: number, rect: CropRect): AlphaPatch {
  const data = new Uint8ClampedArray(rect.width * rect.height);
  for (let y = 0; y < rect.height; y++) {
    const from = (rect.y + y) * width + rect.x;
    data.set(alpha.subarray(from, from + rect.width), y * rect.width);
  }
  return { ...rect, data };
}

/** Writes a patch back into a mask that is `width` wide. */
export function applyPatch(alpha: Uint8ClampedArray, width: number, patch: AlphaPatch): void {
  for (let y = 0; y < patch.height; y++) {
    alpha.set(
      patch.data.subarray(y * patch.width, (y + 1) * patch.width),
      (patch.y + y) * width + patch.x,
    );
  }
}

/** Last-in-first-out history that forgets the oldest entry beyond `limit`. */
export class UndoStack<T> {
  private readonly entries: T[] = [];

  constructor(private readonly limit: number = UNDO_LIMIT) {}

  get size(): number {
    return this.entries.length;
  }

  push(entry: T): void {
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
  }

  pop(): T | undefined {
    return this.entries.pop();
  }
}
