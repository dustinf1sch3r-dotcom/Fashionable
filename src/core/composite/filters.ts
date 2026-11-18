/** Float-plane filters: separable blurs and an exact Euclidean distance transform. */
// A module-level alias: global `Math` lookups are very slow inside Jest's sandbox, which matters in hot loops.
const M = Math;
export type Plane = Float32Array;

function boxH(src: Plane, dst: Plane, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let sum = (src[o] as number) * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[o + M.min(i, w - 1)] as number;
    for (let x = 0; x < w; x++) {
      dst[o + x] = sum * inv;
      sum += (src[o + M.min(x + r + 1, w - 1)] as number) - (src[o + M.max(x - r, 0)] as number);
    }
  }
}

function boxV(src: Plane, dst: Plane, w: number, h: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  const acc = new Float64Array(w);
  for (let x = 0; x < w; x++) acc[x] = (src[x] as number) * (r + 1);
  for (let i = 1; i <= r; i++) {
    const o = M.min(i, h - 1) * w;
    for (let x = 0; x < w; x++) acc[x] = (acc[x] as number) + (src[o + x] as number);
  }
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) dst[o + x] = (acc[x] as number) * inv;
    const add = M.min(y + r + 1, h - 1) * w;
    const sub = M.max(y - r, 0) * w;
    for (let x = 0; x < w; x++)
      acc[x] = (acc[x] as number) + (src[add + x] as number) - (src[sub + x] as number);
  }
}

/** One box blur of integer radius r with clamped (edge-extended) borders. Returns a new plane. */
export function boxBlur(src: Plane, w: number, h: number, r: number): Plane {
  if (r <= 0) return Float32Array.from(src);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  boxH(src, tmp, w, h, r);
  boxV(tmp, out, w, h, r);
  return out;
}

/** Sub-pixel blur: 3-tap [s, 1-2s, s] each way (variance 2s, so sigma^2/2 = s). */
function tinyBlur(src: Plane, w: number, h: number, s: number): Plane {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const c = 1 - 2 * s;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const l = src[o + M.max(x - 1, 0)] as number;
      const rr = src[o + M.min(x + 1, w - 1)] as number;
      tmp[o + x] = s * (l + rr) + c * (src[o + x] as number);
    }
  }
  for (let y = 0; y < h; y++) {
    const up = M.max(y - 1, 0) * w;
    const dn = M.min(y + 1, h - 1) * w;
    const o = y * w;
    for (let x = 0; x < w; x++) {
      out[o + x] =
        s * ((tmp[up + x] as number) + (tmp[dn + x] as number)) + c * (tmp[o + x] as number);
    }
  }
  return out;
}

/** Box sizes (odd) for a three-pass box approximation of a Gaussian. */
export function boxRadiiForSigma(sigma: number): number[] {
  const wIdeal = M.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = M.floor(wIdeal);
  if (wl % 2 === 0) wl -= 1;
  const wu = wl + 2;
  const m = M.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  return [0, 1, 2].map((i) => ((i < m ? wl : wu) - 1) / 2);
}

/** Gaussian-like blur (three box passes; a 3-tap kernel below sigma 0.8). Returns a new plane. */
export function gaussianBlur(src: Plane, w: number, h: number, sigma: number): Plane {
  if (sigma < 0.05) return Float32Array.from(src);
  if (sigma < 0.8) return tinyBlur(src, w, h, (sigma * sigma) / 2);
  let cur = src;
  for (const r of boxRadiiForSigma(sigma)) cur = boxBlur(cur, w, h, r);
  return cur;
}

/** Feather an alpha plane (0..1) by a Gaussian of the given sigma. */
export function featherAlpha(alpha: Plane, w: number, h: number, sigma: number): Plane {
  return gaussianBlur(alpha, w, h, sigma);
}

const BIG = 1e12;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = 0;
    for (;;) {
      const p = v[k] as number;
      s = ((f[q] as number) + q * q - ((f[p] as number) + p * p)) / (2 * q - 2 * p);
      if (s <= (z[k] as number) && k > 0) k--;
      else break;
    }
    if (s <= (z[k] as number)) {
      v[k] = q;
      z[k + 1] = Infinity;
    } else {
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while ((z[k + 1] as number) < q) k++;
    const p = v[k] as number;
    d[q] = (q - p) * (q - p) + (f[p] as number);
  }
}

/**
 * Exact Euclidean distance (px) from every pixel to the nearest pixel that is NOT inside the mask
 * (Felzenszwalb–Huttenlocher). Outside pixels are 0. The plane border does not count as an edge;
 * with nothing outside, every inside pixel gets a large distance.
 */
export function distanceTransform(inside: Uint8Array, w: number, h: number): Plane {
  const grid = new Float64Array(w * h);
  for (let i = 0; i < grid.length; i++) grid[i] = inside[i] ? BIG : 0;
  const m = M.max(w, h);
  const f = new Float64Array(m);
  const d = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x] as number;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y] as number;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x] as number;
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x] as number;
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = M.sqrt(M.min(grid[i] as number, BIG));
  return out;
}

/** Average f×f blocks (the last block may be smaller). */
export function downsample(
  src: Plane,
  w: number,
  h: number,
  f: number,
): { data: Plane; w: number; h: number } {
  const sw = M.ceil(w / f);
  const sh = M.ceil(h / f);
  const out = new Float32Array(sw * sh);
  for (let sy = 0; sy < sh; sy++) {
    const y0 = sy * f;
    const y1 = M.min(h, y0 + f);
    for (let sx = 0; sx < sw; sx++) {
      const x0 = sx * f;
      const x1 = M.min(w, x0 + f);
      let s = 0;
      for (let y = y0; y < y1; y++) {
        const o = y * w;
        for (let x = x0; x < x1; x++) s += src[o + x] as number;
      }
      out[sy * sw + sx] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return { data: out, w: sw, h: sh };
}

/** Bilinear upsample of a plane produced by `downsample` with the same factor. */
export function upsample(
  src: Plane,
  sw: number,
  sh: number,
  w: number,
  h: number,
  f: number,
): Plane {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = M.min(sh - 1, M.max(0, (y + 0.5) / f - 0.5));
    const y0 = M.floor(fy);
    const y1 = M.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = M.min(sw - 1, M.max(0, (x + 0.5) / f - 0.5));
      const x0 = M.floor(fx);
      const x1 = M.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const a = (src[y0 * sw + x0] as number) * (1 - tx) + (src[y0 * sw + x1] as number) * tx;
      const b = (src[y1 * sw + x0] as number) * (1 - tx) + (src[y1 * sw + x1] as number) * tx;
      out[y * w + x] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

/** Gaussian blur that works on a downsampled copy when sigma is large (cheap, smooth result). */
export function blurLarge(src: Plane, w: number, h: number, sigma: number): Plane {
  const f = sigma >= 8 ? 4 : sigma >= 3.5 ? 2 : 1;
  if (f === 1) return gaussianBlur(src, w, h, sigma);
  const small = downsample(src, w, h, f);
  const blurred = gaussianBlur(small.data, small.w, small.h, sigma / f);
  return upsample(blurred, small.w, small.h, w, h, f);
}
