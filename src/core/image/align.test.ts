import { ALIGN_MAX_LOSS, alignCutout, boxDownsample } from './align';

/** Small deterministic generator so the "photo" has texture without Math.random. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface Scene {
  photo: Uint8ClampedArray;
  pw: number;
  ph: number;
  /** Garment membership per photo pixel. */
  inside: (x: number, y: number) => boolean;
}

/** A noisy light backdrop with a striped red T shape on it. */
function scene(pw: number, ph: number): Scene {
  const rand = lcg(7);
  const inside = (x: number, y: number): boolean => {
    const body = x >= 0.3 * pw && x < 0.7 * pw && y >= 0.3 * ph && y < 0.85 * ph;
    const sleeves = x >= 0.12 * pw && x < 0.88 * pw && y >= 0.3 * ph && y < 0.45 * ph;
    return body || sleeves;
  };
  const photo = new Uint8ClampedArray(pw * ph * 4);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4;
      const noise = rand() * 14;
      if (inside(x, y)) {
        const stripe = Math.floor(x / 6) % 2 === 0 ? 0 : 40;
        photo[i] = 190 + stripe / 4;
        photo[i + 1] = 30 + stripe;
        photo[i + 2] = 40 + noise;
      } else {
        photo[i] = 225 + noise;
        photo[i + 1] = 225 + noise;
        photo[i + 2] = 215 + noise;
      }
      photo[i + 3] = 255;
    }
  }
  return { photo, pw, ph, inside };
}

/** The cutout the pipeline would make: crop to the garment's box plus padding, optionally scale. */
function cutOut(sc: Scene, crop: { x: number; y: number; w: number; h: number }, scale: number) {
  const cw = Math.max(1, Math.round(crop.w * scale));
  const ch = Math.max(1, Math.round(crop.h * scale));
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const px = Math.min(sc.pw - 1, crop.x + Math.floor(x / scale));
      const py = Math.min(sc.ph - 1, crop.y + Math.floor(y / scale));
      const i = (py * sc.pw + px) * 4;
      const o = (y * cw + x) * 4;
      out[o] = sc.photo[i];
      out[o + 1] = sc.photo[i + 1];
      out[o + 2] = sc.photo[i + 2];
      out[o + 3] = sc.inside(px, py) ? 255 : 0;
    }
  }
  return { rgba: out, cw, ch };
}

describe('boxDownsample', () => {
  it('averages colour by alpha and alpha plainly', () => {
    const src = new Uint8ClampedArray([
      200,
      0,
      0,
      255,
      0,
      0,
      0,
      0, // opaque red, transparent black
      200,
      0,
      0,
      255,
      0,
      0,
      0,
      0,
    ]);
    const out = boxDownsample(src, 2, 2, 1, 1);
    expect(Array.from(out)).toEqual([200, 0, 0, 128]);
  });
});

describe('alignCutout', () => {
  const sc = scene(240, 320);
  const crop = { x: 24, y: 86, w: 192, h: 192 };

  it('finds an unscaled crop within a pixel', () => {
    const { rgba, cw, ch } = cutOut(sc, crop, 1);
    const found = alignCutout(sc.photo, sc.pw, sc.ph, rgba, cw, ch);
    expect(found.loss).toBeLessThan(ALIGN_MAX_LOSS);
    expect(found.x).toBeGreaterThanOrEqual(crop.x - 1);
    expect(found.x).toBeLessThanOrEqual(crop.x + 1);
    expect(found.y).toBeGreaterThanOrEqual(crop.y - 1);
    expect(found.y).toBeLessThanOrEqual(crop.y + 1);
    expect(found.width).toBeCloseTo(crop.w, -1);
  });

  it('finds a crop that was scaled down', () => {
    const { rgba, cw, ch } = cutOut(sc, crop, 0.75);
    const found = alignCutout(sc.photo, sc.pw, sc.ph, rgba, cw, ch);
    expect(found.loss).toBeLessThan(ALIGN_MAX_LOSS);
    expect(Math.abs(found.x - crop.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(found.y - crop.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(found.width - crop.w)).toBeLessThanOrEqual(3);
  });

  it('reports a poor match for a cutout of a different photo', () => {
    const other = scene(240, 320);
    for (let i = 0; i < other.photo.length; i += 4) {
      other.photo[i] = 255 - other.photo[i];
      other.photo[i + 1] = 255 - other.photo[i + 1];
      other.photo[i + 2] = 255 - other.photo[i + 2];
    }
    const { rgba, cw, ch } = cutOut(other, crop, 1);
    const found = alignCutout(sc.photo, sc.pw, sc.ph, rgba, cw, ch);
    expect(found.loss).toBeGreaterThan(ALIGN_MAX_LOSS);
  });
});
