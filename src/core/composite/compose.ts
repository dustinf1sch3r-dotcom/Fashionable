import { applyGains, colourGains } from './colour';
import { gaussianBlur } from './filters';
import type { Plane } from './filters';
import { addGrain, grainSigma, softnessSigma } from './grain';
import { COMPOSITE_RULES } from './rules';
import { photoShading, silhouetteShading } from './shading';
import { shadowMultiplier } from './shadow';
import { analysePhoto, luminancePlane } from './stats';
import type { PhotoStats } from './stats';
import type { CompositeInput, CompositeLayer, RGBAImage } from './types';

// A module-level alias: global `Math` lookups are very slow inside Jest's sandbox, which matters in hot loops.
const M = Math;

interface Context {
  out: Uint8ClampedArray;
  width: number;
  height: number;
  photo: boolean;
  stats: PhotoStats | null;
  lum: Plane | null;
  density: number;
  seed: number;
}

function drawLayer(ctx: Context, layer: CompositeLayer, index: number): void {
  const { width: W, height: H } = ctx;
  const img = layer.image;
  const lx = M.round(layer.x);
  const ly = M.round(layer.y);
  // Overlap of the layer with the canvas (layers may hang over the edge; the rest is clipped).
  const ox0 = M.max(0, lx);
  const oy0 = M.max(0, ly);
  const ox1 = M.min(W, lx + img.width);
  const oy1 = M.min(H, ly + img.height);
  if (ox1 <= ox0 || oy1 <= oy0 || img.data.length < img.width * img.height * 4) return;

  const scale = M.min(COMPOSITE_RULES.densityMax, M.max(COMPOSITE_RULES.densityMin, ctx.density));
  const soft = ctx.photo && ctx.stats ? softnessSigma(ctx.stats.sharpness, scale) : 0;
  const feather = COMPOSITE_RULES.feather.sigma * scale;
  const sigma = M.sqrt(soft * soft + feather * feather);
  const SR = COMPOSITE_RULES.shadow;
  // W is already in output pixels (it includes the density), so no further density factor here.
  const sSigma = M.max(0.5, SR.radiusFrac * W * SR.sigmaPerRadius);

  // Working region: the overlap plus a transparent margin where blur and shadow can spread. On
  // sides where the layer was clipped by the canvas edge the margin is simply absent.
  const margin = M.ceil(3 * M.max(sigma, sSigma)) + 2;
  const x0 = M.max(0, ox0 - margin);
  const y0 = M.max(0, oy0 - margin);
  const x1 = M.min(W, ox1 + margin);
  const y1 = M.min(H, oy1 + margin);
  const w = x1 - x0;
  const h = y1 - y0;
  const n = w * h;

  let r: Plane = new Float32Array(n);
  let g: Plane = new Float32Array(n);
  let b: Plane = new Float32Array(n);
  let a: Plane = new Float32Array(n);
  let sumA = 0;
  for (let y = oy0; y < oy1; y++) {
    let p = ((y - ly) * img.width + (ox0 - lx)) * 4;
    let i = (y - y0) * w + (ox0 - x0);
    for (let x = ox0; x < ox1; x++, p += 4, i++) {
      const al = (img.data[p + 3] as number) / 255;
      r[i] = img.data[p] as number;
      g[i] = img.data[p + 1] as number;
      b[i] = img.data[p + 2] as number;
      a[i] = al;
      sumA += al;
    }
  }
  if (sumA <= 0) return;

  // 1. Colour matching (photo only).
  if (ctx.photo && ctx.stats) applyGains(r, g, b, colourGains(ctx.stats));

  // 2. Shading.
  let mult: Plane;
  if (ctx.photo && ctx.lum) {
    const lum = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      lum.set(ctx.lum.subarray((y0 + y) * W + x0, (y0 + y) * W + x1), y * w);
    }
    mult = photoShading(lum, a, w, h, W);
  } else {
    mult = silhouetteShading(a, w, h, W);
  }
  for (let i = 0; i < n; i++) {
    const m = mult[i] as number;
    r[i] = M.min(255, (r[i] as number) * m);
    g[i] = M.min(255, (g[i] as number) * m);
    b[i] = M.min(255, (b[i] as number) * m);
  }

  // 3 + 4. Photo sharpness and the ~1 px alpha feather: one blur of premultiplied colour and alpha
  // (premultiplied so transparent pixels' colour never bleeds in as a dark fringe).
  for (let i = 0; i < n; i++) {
    const al = a[i] as number;
    r[i] = (r[i] as number) * al;
    g[i] = (g[i] as number) * al;
    b[i] = (b[i] as number) * al;
  }
  r = gaussianBlur(r, w, h, sigma);
  g = gaussianBlur(g, w, h, sigma);
  b = gaussianBlur(b, w, h, sigma);
  a = gaussianBlur(a, w, h, sigma);
  for (let i = 0; i < n; i++) {
    const al = a[i] as number;
    if (al > 1e-4) {
      r[i] = M.min(255, (r[i] as number) / al);
      g[i] = M.min(255, (g[i] as number) / al);
      b[i] = M.min(255, (b[i] as number) / al);
    } else {
      a[i] = 0;
    }
  }
  if (ctx.photo && ctx.stats) {
    addGrain(r, g, b, a, grainSigma(ctx.stats.noise), ctx.seed + index * 7919);
  }

  // 5. Contact shadow beneath the layer.
  const sm = shadowMultiplier(a, w, h, sSigma, ctx.photo ? SR.opacityPhoto : SR.opacitySilhouette);
  const out = ctx.out;
  for (let y = 0; y < h; y++) {
    let p = ((y0 + y) * W + x0) * 4;
    let i = y * w;
    for (let x = 0; x < w; x++, p += 4, i++) {
      const m = sm[i] as number;
      if (m >= 1) continue;
      out[p] = (out[p] as number) * m;
      out[p + 1] = (out[p + 1] as number) * m;
      out[p + 2] = (out[p + 2] as number) * m;
    }
  }

  // 6. Normal "over" in straight RGBA.
  for (let y = 0; y < h; y++) {
    let p = ((y0 + y) * W + x0) * 4;
    let i = y * w;
    for (let x = 0; x < w; x++, p += 4, i++) {
      const la = a[i] as number;
      if (la <= 0) continue;
      const oa = (out[p + 3] as number) / 255;
      const ra = la + oa * (1 - la);
      const wo = (oa * (1 - la)) / ra;
      const wl = la / ra;
      out[p] = (r[i] as number) * wl + (out[p] as number) * wo;
      out[p + 1] = (g[i] as number) * wl + (out[p + 1] as number) * wo;
      out[p + 2] = (b[i] as number) * wl + (out[p + 2] as number) * wo;
      out[p + 3] = ra * 255;
    }
  }
}

/** The merged image: backdrop with every layer colour-matched, shaded, softened and shadowed. */
export function compositeOutfit(input: CompositeInput): RGBAImage {
  const { backdrop, kind } = input;
  const photo = kind === 'photo';
  const lum = photo ? luminancePlane(backdrop) : null;
  const ctx: Context = {
    out: new Uint8ClampedArray(backdrop.data),
    width: backdrop.width,
    height: backdrop.height,
    photo,
    stats: photo && lum ? analysePhoto(backdrop, lum) : null,
    lum,
    density: input.density,
    seed: input.seed,
  };
  input.layers.forEach((layer, i) => drawLayer(ctx, layer, i));
  return { width: backdrop.width, height: backdrop.height, data: ctx.out };
}
