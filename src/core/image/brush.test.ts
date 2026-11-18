import {
  UndoStack,
  applyPatch,
  brushRadius,
  capturePatch,
  stampBrush,
  strokePoints,
  unionRect,
} from './brush';

const mask = (w: number, h: number, value: number) => new Uint8ClampedArray(w * h).fill(value);

describe('brushRadius', () => {
  it('scales with the shorter side and grows with the size', () => {
    expect(brushRadius('m', 600, 800)).toBeCloseTo(18);
    expect(brushRadius('s', 600, 800)).toBeLessThan(brushRadius('m', 600, 800));
    expect(brushRadius('l', 600, 800)).toBeGreaterThan(brushRadius('m', 600, 800));
    expect(brushRadius('s', 20, 20)).toBe(2);
  });
});

describe('stampBrush', () => {
  it('erases a round hole with a soft rim and leaves the rest alone', () => {
    const a = mask(40, 40, 255);
    const dirty = stampBrush(a, 40, 40, 20, 20, 8, 'erase');
    expect(a[20 * 40 + 20]).toBe(0);
    expect(a[0]).toBe(255);
    expect(a[20 * 40 + 29]).toBe(255); // just outside the radius
    const rim = a[20 * 40 + 27]; // inside the feathered edge
    expect(rim).toBeGreaterThan(0);
    expect(rim).toBeLessThan(255);
    expect(dirty).toEqual({ x: 12, y: 12, width: 16, height: 16 });
  });

  it('restores towards opaque', () => {
    const a = mask(40, 40, 0);
    stampBrush(a, 40, 40, 20, 20, 8, 'restore');
    expect(a[20 * 40 + 20]).toBe(255);
    expect(a[0]).toBe(0);
  });

  it('is symmetric around its centre', () => {
    const a = mask(41, 41, 255);
    stampBrush(a, 41, 41, 20.5, 20.5, 9, 'erase');
    expect(a[20 * 41 + 14]).toBe(a[20 * 41 + 26]);
    expect(a[14 * 41 + 20]).toBe(a[26 * 41 + 20]);
  });

  it('clips at the edges and reports nothing for an outside stamp', () => {
    const a = mask(20, 20, 255);
    expect(stampBrush(a, 20, 20, 0, 0, 5, 'erase')).toEqual({ x: 0, y: 0, width: 5, height: 5 });
    expect(a[0]).toBe(0);
    expect(stampBrush(a, 20, 20, 100, 100, 5, 'erase')).toBeUndefined();
    expect(stampBrush(a, 20, 20, 10, 10, 0, 'erase')).toBeUndefined();
  });

  it('never leaves the 0..255 range when strokes overlap', () => {
    const a = mask(30, 30, 128);
    for (let i = 0; i < 5; i++) stampBrush(a, 30, 30, 15, 15, 6, 'restore');
    expect(Math.max(...a)).toBe(255);
    for (let i = 0; i < 5; i++) stampBrush(a, 30, 30, 15, 15, 6, 'erase');
    expect(Math.min(...a)).toBe(0);
  });
});

describe('strokePoints', () => {
  it('is a single dot for the first sample', () => {
    expect(strokePoints(undefined, { x: 3, y: 4 }, 2)).toEqual([{ x: 3, y: 4 }]);
    expect(strokePoints({ x: 3, y: 4 }, { x: 3, y: 4 }, 2)).toEqual([{ x: 3, y: 4 }]);
  });

  it('fills the gap between two samples without gaps larger than the spacing', () => {
    const pts = strokePoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 3);
    expect(pts[pts.length - 1]).toEqual({ x: 10, y: 0 });
    let prev = { x: 0, y: 0 };
    for (const p of pts) {
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThanOrEqual(3 + 1e-9);
      prev = p;
    }
    expect(pts).toHaveLength(4);
  });

  it('does not duplicate the end when it lands on a step', () => {
    expect(strokePoints({ x: 0, y: 0 }, { x: 6, y: 0 }, 3)).toEqual([
      { x: 3, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it('works on diagonals', () => {
    const pts = strokePoints({ x: 0, y: 0 }, { x: 3, y: 4 }, 1);
    expect(pts).toHaveLength(5);
    expect(pts[0].x).toBeCloseTo(0.6);
    expect(pts[0].y).toBeCloseTo(0.8);
  });
});

describe('unionRect', () => {
  it('grows to hold both', () => {
    const r = { x: 2, y: 3, width: 4, height: 4 };
    expect(unionRect(undefined, r)).toBe(r);
    expect(unionRect(r, { x: 5, y: 0, width: 10, height: 4 })).toEqual({
      x: 2,
      y: 0,
      width: 13,
      height: 7,
    });
  });
});

describe('patches and undo', () => {
  it('captures a region and puts it back', () => {
    const a = mask(10, 10, 255);
    const before = a.slice();
    const rect = { x: 0, y: 0, width: 8, height: 7 };
    const patch = capturePatch(a, 10, rect);
    stampBrush(a, 10, 10, 4, 3, 3, 'erase');
    expect(a).not.toEqual(before);
    applyPatch(a, 10, patch);
    expect(a).toEqual(before);
  });

  it('undoes a stroke exactly, several times over', () => {
    const w = 30;
    const a = mask(w, w, 255);
    const history = new UndoStack<ReturnType<typeof capturePatch>>();
    const states = [a.slice()];
    for (const cx of [8, 15, 22]) {
      const snapshot = a.slice();
      const dirty = stampBrush(a, w, w, cx, 15, 5, 'erase');
      if (!dirty) throw new Error('stamp missed');
      history.push(capturePatch(snapshot, w, dirty));
      states.push(a.slice());
    }
    for (let i = 2; i >= 0; i--) {
      const patch = history.pop();
      if (!patch) throw new Error('history ran out');
      applyPatch(a, w, patch);
      expect(a).toEqual(states[i]);
    }
    expect(history.pop()).toBeUndefined();
  });

  it('keeps the newest entries when over the limit (at least 10 steps)', () => {
    const stack = new UndoStack<number>();
    for (let i = 0; i < 30; i++) stack.push(i);
    expect(stack.size).toBeGreaterThanOrEqual(10);
    expect(stack.pop()).toBe(29);
    const small = new UndoStack<number>(3);
    [1, 2, 3, 4].forEach((n) => small.push(n));
    expect(small.size).toBe(3);
    expect([small.pop(), small.pop(), small.pop()]).toEqual([4, 3, 2]);
  });
});
