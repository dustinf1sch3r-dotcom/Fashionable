import { shadowMultiplier } from './shadow';

describe('contact shadow', () => {
  const w = 40;
  const h = 40;
  const alpha = new Float32Array(w * h);
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) alpha[y * w + x] = 1;
  const m = shadowMultiplier(alpha, w, h, 2, 0.25);

  it('darkens the halo just outside the garment, fading with distance', () => {
    const near = m[20 * w + 9] as number;
    const far = m[20 * w + 4] as number;
    expect(near).toBeLessThan(0.9);
    expect(near).toBeGreaterThanOrEqual(0.75);
    expect(far).toBeGreaterThan(near);
    expect(m[20 * w + 0]).toBeGreaterThan(0.99);
  });

  it('does not darken under the fully opaque area', () => {
    expect(m[20 * w + 20]).toBe(1);
    expect(m[12 * w + 12]).toBe(1);
  });

  it('a fully transparent layer casts nothing; opacity scales the shadow', () => {
    expect(shadowMultiplier(new Float32Array(w * h), w, h, 2, 0.25).every((v) => v === 1)).toBe(
      true,
    );
    const strong = shadowMultiplier(alpha, w, h, 2, 0.5);
    expect(1 - (strong[20 * w + 9] as number)).toBeCloseTo(2 * (1 - (m[20 * w + 9] as number)), 5);
  });

  it('darkens under a soft edge in proportion to its transparency', () => {
    const soft = new Float32Array(w * h).fill(0.5);
    const s = shadowMultiplier(soft, w, h, 2, 0.25);
    expect(s[20 * w + 20]).toBeCloseTo(1 - 0.25 * 0.5 * 0.5, 4);
  });
});
