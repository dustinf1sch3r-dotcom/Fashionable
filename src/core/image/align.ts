/**
 * Finds where a trimmed cutout sits in the photo it was cut from. The cutout PNG is the photo's
 * pixels with a new alpha channel, cropped to the garment and possibly scaled down, but the crop
 * is not stored anywhere. The touch-up brush needs it to paint pixels back from the photo, so it
 * is recovered here by matching colours: opaque pixels must land on the same colours, and the
 * transparent pixels just outside the garment must land on something that differs from the cloth.
 * Pure: pixels in, rectangle out.
 */

/** A cutout found at `x`, `y` in the photo, `width` x `height` photo pixels in size. */
export interface Alignment {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Mean colour error (0..255 scale) at the best position; large when nothing fits. */
  loss: number;
}

/** Above this loss the match is not trusted and the caller should not restore from the photo. */
export const ALIGN_MAX_LOSS = 45;
/** Longest side of the photo while searching coarsely. */
export const ALIGN_COARSE_PHOTO = 200;
/** Longest side of the cutout samples while searching coarsely and while refining. */
export const ALIGN_COARSE_CUTOUT = 96;
export const ALIGN_FINE_CUTOUT = 384;
/** A transparent pixel beside the cloth should differ from it by at least this much. */
export const ALIGN_RING_MARGIN = 60;

const OPAQUE = 250;
const CLEAR = 16;
const MAX_INNER = 500;
const MAX_EDGE = 300;
const MAX_RING = 300;

/**
 * Area-average resize of RGBA pixels. Colours are weighted by alpha so transparent pixels (whose
 * colour is meaningless) do not darken the garment; alpha is the plain average.
 */
export function boxDownsample(
  src: ArrayLike<number>,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) {
    const y0 = Math.floor((dy * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * sh) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const x0 = Math.floor((dx * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * sw) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * sw + x) * 4;
          const w = src[i + 3];
          r += src[i] * w;
          g += src[i + 1] * w;
          b += src[i + 2] * w;
          a += w;
          n++;
        }
      }
      const o = (dy * dw + dx) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / n;
    }
  }
  return out;
}

interface Samples {
  count: number;
  /** Pixel position in the (small) cutout the samples were taken from. */
  u: Float32Array;
  v: Float32Array;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  /** 1 for a transparent pixel beside the cloth, 0 for a cloth pixel. */
  ring: Uint8Array;
  width: number;
  height: number;
}

function pick<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const stride = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * stride)]);
}

function buildSamples(rgba: Uint8ClampedArray, w: number, h: number): Samples {
  const alphaAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : rgba[(y * w + x) * 4 + 3];
  const inner: number[] = [];
  const edge: number[] = [];
  const ring: number[] = [];
  const ringSource = new Map<number, number>();
  let opaque = 0;
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] >= OPAQUE) opaque++;
  const stride = Math.max(1, Math.floor(Math.sqrt(opaque / MAX_INNER)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alphaAt(x, y);
      const idx = y * w + x;
      if (a >= OPAQUE) {
        const touchesClear =
          alphaAt(x - 1, y) < CLEAR ||
          alphaAt(x + 1, y) < CLEAR ||
          alphaAt(x, y - 1) < CLEAR ||
          alphaAt(x, y + 1) < CLEAR;
        if (touchesClear) edge.push(idx);
        else if (x % stride === 0 && y % stride === 0) inner.push(idx);
      } else if (a < CLEAR) {
        // The nearest cloth pixel within two pixels, looking along the eight directions.
        let found = -1;
        for (let d = 1; d <= 2 && found < 0; d++) {
          for (let dy = -1; dy <= 1 && found < 0; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (alphaAt(x + dx * d, y + dy * d) >= OPAQUE) {
                found = (y + dy * d) * w + (x + dx * d);
                break;
              }
            }
          }
        }
        if (found >= 0) {
          ring.push(idx);
          ringSource.set(idx, found);
        }
      }
    }
  }
  const chosen = [
    ...pick(inner, MAX_INNER).map((i) => ({ i, c: i, ring: 0 })),
    ...pick(edge, MAX_EDGE).map((i) => ({ i, c: i, ring: 0 })),
    ...pick(ring, MAX_RING).map((i) => ({ i, c: ringSource.get(i) ?? i, ring: 1 })),
  ];
  const s: Samples = {
    count: chosen.length,
    u: new Float32Array(chosen.length),
    v: new Float32Array(chosen.length),
    r: new Uint8Array(chosen.length),
    g: new Uint8Array(chosen.length),
    b: new Uint8Array(chosen.length),
    ring: new Uint8Array(chosen.length),
    width: w,
    height: h,
  };
  chosen.forEach(({ i, c, ring: isRing }, n) => {
    s.u[n] = (i % w) + 0.5;
    s.v[n] = Math.floor(i / w) + 0.5;
    s.r[n] = rgba[c * 4];
    s.g[n] = rgba[c * 4 + 1];
    s.b[n] = rgba[c * 4 + 2];
    s.ring[n] = isRing;
  });
  return s;
}

interface Photo {
  rgba: ArrayLike<number>;
  width: number;
  height: number;
  /** Photo pixels to these pixels (1 for the full-size photo). */
  kx: number;
  ky: number;
}

/**
 * Mean error when the cutout's samples are laid over the photo with its centre at (`cx`, `cy`)
 * and `w` photo pixels wide. Stops early, returning a value above `bound`, once it cannot win.
 */
function lossAt(
  s: Samples,
  photo: Photo,
  cx: number,
  cy: number,
  w: number,
  ratio: number,
  bound: number,
): number {
  if (s.count === 0) return Infinity;
  const h = w * ratio;
  const sx = w / s.width;
  const sy = h / s.height;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const limit = bound * s.count;
  let sum = 0;
  for (let n = 0; n < s.count; n++) {
    const px = Math.floor((x0 + s.u[n] * sx) * photo.kx);
    const py = Math.floor((y0 + s.v[n] * sy) * photo.ky);
    if (px < 0 || py < 0 || px >= photo.width || py >= photo.height) {
      if (s.ring[n] === 0) sum += 255;
    } else {
      const i = (py * photo.width + px) * 4;
      const diff =
        (Math.abs(photo.rgba[i] - s.r[n]) +
          Math.abs(photo.rgba[i + 1] - s.g[n]) +
          Math.abs(photo.rgba[i + 2] - s.b[n])) /
        3;
      sum += s.ring[n] === 1 ? Math.max(0, ALIGN_RING_MARGIN - diff) : diff;
    }
    if ((n & 31) === 31 && sum >= limit) return sum / s.count;
  }
  return sum / s.count;
}

function downsampled(
  rgba: ArrayLike<number>,
  w: number,
  h: number,
  longest: number,
): { rgba: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, longest / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  return { rgba: boxDownsample(rgba, w, h, dw, dh), width: dw, height: dh };
}

/**
 * Where `cutout` (RGBA, `cw` x `ch`, the photo cropped to the garment and scaled down, never up)
 * lies in `photo` (RGBA, `pw` x `ph`). A coarse exhaustive search on shrunken copies is refined
 * by a pattern search at full size. Check `loss` against `ALIGN_MAX_LOSS` before trusting it.
 */
export function alignCutout(
  photo: ArrayLike<number>,
  pw: number,
  ph: number,
  cutout: ArrayLike<number>,
  cw: number,
  ch: number,
): Alignment {
  const ratio = ch / cw;
  const wMax = Math.max(1, Math.min(pw, ph / ratio));
  const wMin = Math.min(wMax, Math.max(1, cw - 1));

  const small = downsampled(photo, pw, ph, ALIGN_COARSE_PHOTO);
  const coarsePhoto: Photo = {
    rgba: small.rgba,
    width: small.width,
    height: small.height,
    kx: small.width / pw,
    ky: small.height / ph,
  };
  const coarseCut = downsampled(cutout, cw, ch, ALIGN_COARSE_CUTOUT);
  const coarse = buildSamples(coarseCut.rgba, coarseCut.width, coarseCut.height);

  const step = Math.max(1, Math.round(1 / coarsePhoto.kx));
  let best = { cx: pw / 2, cy: ph / 2, w: wMax };
  let bestLoss = Infinity;
  for (let w = wMin; w <= wMax + 1e-9; w += step) {
    const h = w * ratio;
    for (let cy = h / 2; cy <= ph - h / 2 + 1e-9; cy += step) {
      for (let cx = w / 2; cx <= pw - w / 2 + 1e-9; cx += step) {
        const loss = lossAt(coarse, coarsePhoto, cx, cy, w, ratio, bestLoss);
        if (loss < bestLoss) {
          bestLoss = loss;
          best = { cx, cy, w };
        }
      }
    }
  }

  const fineCut = downsampled(cutout, cw, ch, ALIGN_FINE_CUTOUT);
  const fine = buildSamples(fineCut.rgba, fineCut.width, fineCut.height);
  const full: Photo = { rgba: photo, width: pw, height: ph, kx: 1, ky: 1 };
  let fineLoss = lossAt(fine, full, best.cx, best.cy, best.w, ratio, Infinity);
  for (let s = step; s >= 1; s = Math.floor(s / 2)) {
    let improved = true;
    while (improved) {
      improved = false;
      const moves = [
        { cx: s, cy: 0, w: 0 },
        { cx: -s, cy: 0, w: 0 },
        { cx: 0, cy: s, w: 0 },
        { cx: 0, cy: -s, w: 0 },
        { cx: 0, cy: 0, w: s },
        { cx: 0, cy: 0, w: -s },
      ];
      for (const m of moves) {
        const w = Math.min(wMax, Math.max(wMin, best.w + m.w));
        const candidate = { cx: best.cx + m.cx, cy: best.cy + m.cy, w };
        const loss = lossAt(fine, full, candidate.cx, candidate.cy, w, ratio, fineLoss);
        if (loss < fineLoss) {
          fineLoss = loss;
          best = candidate;
          improved = true;
        }
      }
    }
    if (s === 1) break;
  }

  const height = best.w * ratio;
  return {
    x: best.cx - best.w / 2,
    y: best.cy - height / 2,
    width: best.w,
    height,
    loss: fineLoss,
  };
}
