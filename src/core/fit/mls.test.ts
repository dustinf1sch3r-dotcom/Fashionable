import type { Point } from '../model/types';
import { mlsSimilarity } from './mls';

const p = (x: number, y: number): Point => ({ x, y });

const square = [p(0, 0), p(1, 0), p(1, 1), p(0, 1), p(0.5, 0.2)];

describe('mlsSimilarity', () => {
  it('maps every handle exactly onto its target', () => {
    const handles = square.map((src, i) => ({
      p: src,
      q: p(src.x * 3 + i * 0.1, src.y * 2 - i * 0.2),
    }));
    const f = mlsSimilarity(handles);
    for (const h of handles) {
      const out = f(h.p);
      expect(Math.abs(out.x - h.q.x)).toBeLessThan(1e-6);
      expect(Math.abs(out.y - h.q.y)).toBeLessThan(1e-6);
    }
  });

  it('is the identity when targets equal sources', () => {
    const f = mlsSimilarity(square.map((s) => ({ p: s, q: s })));
    for (const v of [p(0.3, 0.7), p(2, -1), p(0.5, 0.5), p(-4, 9)]) {
      const out = f(v);
      expect(out.x).toBeCloseTo(v.x, 9);
      expect(out.y).toBeCloseTo(v.y, 9);
    }
  });

  it('reproduces a global similarity transform everywhere', () => {
    const angle = 0.4;
    const scale = 2.5;
    const move = (s: Point): Point => ({
      x: scale * (Math.cos(angle) * s.x - Math.sin(angle) * s.y) + 10,
      y: scale * (Math.sin(angle) * s.x + Math.cos(angle) * s.y) - 3,
    });
    const f = mlsSimilarity(square.map((s) => ({ p: s, q: move(s) })));
    for (const v of [p(0.25, 0.25), p(0.9, 0.1), p(-1, 2), p(3, 3)]) {
      const out = f(v);
      const want = move(v);
      expect(out.x).toBeCloseTo(want.x, 6);
      expect(out.y).toBeCloseTo(want.y, 6);
    }
  });

  it('translates with a single handle and does nothing with none', () => {
    const f = mlsSimilarity([{ p: p(1, 1), q: p(4, 5) }]);
    expect(f(p(2, 3))).toEqual({ x: 5, y: 7 });
    expect(mlsSimilarity([])(p(2, 3))).toEqual({ x: 2, y: 3 });
  });

  it('rotates and scales with two handles', () => {
    const f = mlsSimilarity([
      { p: p(0, 0), q: p(0, 0) },
      { p: p(1, 0), q: p(0, 2) },
    ]);
    const out = f(p(0.5, 0.5));
    expect(out.x).toBeCloseTo(-1, 9);
    expect(out.y).toBeCloseTo(1, 9);
  });

  it('is deterministic and supports other weight exponents', () => {
    const handles = square.map((s, i) => ({ p: s, q: p(s.x + i * 0.05, s.y * 1.5) }));
    const a = mlsSimilarity(handles, 2)(p(0.4, 0.4));
    const b = mlsSimilarity(handles, 2)(p(0.4, 0.4));
    expect(a).toEqual(b);
    const h = handles[1] as { p: Point; q: Point };
    expect(mlsSimilarity(handles, 2)(h.p).x).toBeCloseTo(h.q.x, 9);
  });
});
