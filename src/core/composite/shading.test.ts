import { photoShading, silhouetteShading } from './shading';

const W = 60;
const H = 40;
const ones = (): Float32Array => new Float32Array(W * H).fill(1);
const mean = (p: Float32Array, a: Float32Array): number => {
  let s = 0;
  let n = 0;
  for (let i = 0; i < p.length; i++) {
    s += (p[i] as number) * (a[i] as number);
    n += a[i] as number;
  }
  return s / n;
};

describe('photo shading', () => {
  it('a flat backdrop gives no shading', () => {
    const m = photoShading(new Float32Array(W * H).fill(120), ones(), W, H, 200);
    for (const v of m) expect(v).toBeCloseTo(1, 4);
  });

  it('a broad shadow under the garment darkens that side', () => {
    // Left half of the photo in shade: the garment's left side should come out darker.
    const lum = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lum[y * W + x] = x < W / 2 ? 70 : 150;
    const m = photoShading(lum, ones(), W, H, 200);
    expect(m[20 * W + 5]).toBeLessThan(m[20 * W + (W - 6)]! - 0.05);
  });

  it('fine detail under the garment does not show through (no see-through fabric)', () => {
    // A narrow dark stripe (a body outline, the edge of the person's own clothes) must barely
    // change the garment: transferring it reads as translucent fabric on real photos.
    const lum = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) lum[y * W + x] = x >= 25 && x < 35 ? 50 : 150;
    const m = photoShading(lum, ones(), W, H, 200);
    expect(Math.abs(m[20 * W + 30]! - m[20 * W + 5]!)).toBeLessThan(0.05);
  });

  it('keeps the average brightness (mean multiplier ~1) and stays within the clamp', () => {
    const lum = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lum[y * W + x] = 60 + x * 2;
    const m = photoShading(lum, ones(), W, H, 200);
    expect(mean(m, ones())).toBeGreaterThan(0.95);
    expect(mean(m, ones())).toBeLessThan(1.05);
    // strength 0.7 over a [0.6,1.25] map: 1 + 0.7 * (-0.4 .. 0.25)
    for (const v of m) {
      expect(v).toBeGreaterThanOrEqual(0.72 - 1e-6);
      expect(v).toBeLessThanOrEqual(1.175 + 1e-6);
    }
  });

  it('ignores backdrop outside the garment alpha', () => {
    const lum = new Float32Array(W * H).fill(200);
    const a = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 30; x < W; x++) a[y * W + x] = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < 30; x++) lum[y * W + x] = 5; // dark, not covered
    const m = photoShading(lum, a, W, H, 200);
    expect(m[20 * W + 31]).toBeCloseTo(1, 2);
  });

  it('fully transparent garment: neutral multipliers', () => {
    const m = photoShading(new Float32Array(W * H).fill(100), new Float32Array(W * H), W, H, 200);
    expect(m.every((v) => v === 1)).toBe(true);
  });

  it('adds a small fold component from fine detail', () => {
    const lum = new Float32Array(W * H).fill(120);
    for (let y = 0; y < H; y++) lum[y * W + 30] = 60;
    const m = photoShading(lum, ones(), W, H, 200);
    expect(m[20 * W + 30]).toBeLessThan(m[20 * W + 10]!);
  });
});

describe('silhouette shading', () => {
  const alpha = new Float32Array(W * H);
  for (let y = 5; y < 35; y++) for (let x = 10; x < 50; x++) alpha[y * W + x] = 1;

  it('is darker at the edges than at the centre', () => {
    const m = silhouetteShading(alpha, W, H, 100);
    expect(m[20 * W + 30]).toBeGreaterThan(m[20 * W + 11]!);
    expect(m[20 * W + 30]).toBeGreaterThan(m[6 * W + 30]!);
  });

  it('the top-left edge is lit more than the bottom-right edge', () => {
    const m = silhouetteShading(alpha, W, H, 100);
    expect(m[6 * W + 11]).toBeGreaterThan(m[33 * W + 48]!);
  });

  it('averages about 1 over the garment and respects strength 0.35', () => {
    const m = silhouetteShading(alpha, W, H, 100);
    expect(mean(m, alpha)).toBeGreaterThan(0.97);
    expect(mean(m, alpha)).toBeLessThan(1.03);
    for (const v of m) {
      expect(v).toBeGreaterThanOrEqual(1 - 0.35 * 0.4 - 1e-6);
      expect(v).toBeLessThanOrEqual(1 + 0.35 * 0.25 + 1e-6);
    }
  });

  it('empty garment: neutral', () => {
    const m = silhouetteShading(new Float32Array(W * H), W, H, 100);
    expect(m.every((v) => v === 1)).toBe(true);
  });

  it('large garments (half-resolution distance) still shade edge darker than centre', () => {
    const bw = 300;
    const bh = 200;
    const big = new Float32Array(bw * bh);
    for (let y = 20; y < 180; y++) for (let x = 30; x < 270; x++) big[y * bw + x] = 1;
    const m = silhouetteShading(big, bw, bh, 400);
    expect(m[100 * bw + 150]).toBeGreaterThan(m[100 * bw + 31]! + 0.03);
    expect(mean(m, big)).toBeGreaterThan(0.97);
    expect(mean(m, big)).toBeLessThan(1.03);
  });
});
