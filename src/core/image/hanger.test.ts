import type { AlphaMask } from '../fit/contract';
import { garmentMask, type GarmentName } from '../testing/garmentMasks';
import { HANGER_RULES, removeHanger, removeHangerFromRgba } from './hanger';

const ALL: GarmentName[] = [
  'tee',
  'longSleeve',
  'sleevelessTop',
  'coat',
  'jeans',
  'wideLeg',
  'shorts',
  'aLineSkirt',
  'pencilSkirt',
  'sleevedDress',
  'sleevelessDress',
  'jumpsuit',
];

interface Canvas {
  mask: AlphaMask;
  /** First opaque row of the garment alone (before anything was added). */
  top: number;
  /** Middle column of the garment. */
  cx: number;
  /** Garment width (px). */
  width: number;
}

/** A tee in a taller canvas, with room above it for a hanger. */
function teeOnCanvas(height = 480, room = 160): Canvas {
  const g = garmentMask('tee', { height, margin: 10 });
  const { width, height: h, alpha } = g.mask;
  const out = new Uint8Array(width * (h + room));
  out.set(alpha, room * width);
  let top = -1;
  let x0 = width;
  let x1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x]) {
        if (top < 0) top = y + room;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
  }
  return {
    mask: { width, height: h + room, alpha: out },
    top,
    cx: Math.round((x0 + x1 + 1) / 2),
    width: x1 - x0 + 1,
  };
}

function fillRect(m: AlphaMask, x: number, y: number, w: number, h: number, v = 255): void {
  for (let yy = Math.max(0, y); yy < Math.min(m.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(m.width, x + w); xx++) {
      (m.alpha as Uint8Array)[yy * m.width + xx] = v;
    }
  }
}

/** Cells above the garment's top row that are opaque. */
function opaqueAbove(m: AlphaMask, top: number): number {
  let n = 0;
  for (let y = 0; y < top; y++) for (let x = 0; x < m.width; x++) if (m.alpha[y * m.width + x]) n++;
  return n;
}

function same(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** A wire hook: a 3 px stem up from the neck, a curl, and two arms down along the shoulders. */
function addWireHook(c: Canvas, tall = 90): void {
  const { mask, cx, top } = c;
  const neckY = top + Math.round(0.03 * mask.height);
  fillRect(mask, cx - 1, neckY - tall, 3, tall + 4);
  fillRect(mask, cx - 1, neckY - tall, 22, 3); // curl, to the right
  fillRect(mask, cx + 19, neckY - tall, 3, 18);
  // Arms: one-pixel-steps of a 3 px line towards the shoulders.
  for (let i = 0; i < 70; i++) {
    fillRect(mask, cx - i - 2, neckY + Math.round(i * 0.25) - 6, 3, 3);
    fillRect(mask, cx + i, neckY + Math.round(i * 0.25) - 6, 3, 3);
  }
}

describe('removeHanger', () => {
  it('leaves a clean garment untouched, for every procedural garment, tilted or not', () => {
    for (const name of ALL) {
      for (const rotate of [0, 4]) {
        const g = garmentMask(name, { rotate });
        const result = removeHanger(g.mask);
        expect(result.removedPixels).toBe(0);
        expect(same(result.alpha, g.mask.alpha)).toBe(true);
      }
    }
  });

  it('does not touch the input mask and returns a copy', () => {
    const c = teeOnCanvas();
    addWireHook(c);
    const before = Uint8Array.from(c.mask.alpha);
    const result = removeHanger(c.mask);
    expect(same(c.mask.alpha, before)).toBe(true);
    expect(result.alpha).not.toBe(c.mask.alpha);
  });

  it.each([480, 457, 521, 300])(
    'removes a wire hook above a tee (%d px high) and nothing of the tee',
    (height) => {
      const c = teeOnCanvas(height, Math.round(height / 3));
      const clean = Uint8Array.from(c.mask.alpha);
      addWireHook(c, Math.round(height / 5));
      expect(opaqueAbove(c.mask, c.top)).toBeGreaterThan(100);
      const result = removeHanger(c.mask);
      expect(result.removedPixels).toBeGreaterThan(100);
      const after: AlphaMask = { ...c.mask, alpha: result.alpha };
      expect(opaqueAbove(after, c.top)).toBe(0);
      // Every pixel of the tee itself is still there.
      for (let i = c.top * c.mask.width; i < clean.length; i++) {
        if (clean[i]) expect(result.alpha[i]).toBe(clean[i]);
      }
    },
  );

  it('removes a soft, anti-aliased wire (alpha 40-120) too', () => {
    const c = teeOnCanvas();
    const { mask, cx, top } = c;
    const neckY = top + Math.round(0.03 * mask.height);
    fillRect(mask, cx - 3, neckY - 100, 7, 104, 30);
    fillRect(mask, cx - 2, neckY - 100, 5, 104, 80);
    fillRect(mask, cx - 1, neckY - 100, 3, 104, 130);
    const result = removeHanger(mask);
    expect(opaqueAbove({ ...mask, alpha: result.alpha }, top)).toBe(0);
  });

  it('removes a wooden bar hanger: a hook plus a narrow neck block above the shoulders', () => {
    const c = teeOnCanvas();
    const { mask, cx, top, width } = c;
    // The hanger neck: 9% of the garment's width, rising 6% of it above the shoulder line.
    const bw = Math.round(0.09 * width);
    const bh = Math.round(0.06 * width);
    fillRect(mask, cx - Math.floor(bw / 2), top - bh, bw, bh + 70);
    fillRect(mask, cx - 1, top - bh - 80, 3, 82);
    const result = removeHanger(mask);
    expect(result.removedPixels).toBeGreaterThan(0);
    expect(opaqueAbove({ ...mask, alpha: result.alpha }, top)).toBe(0);
  });

  it('keeps a hood: wide, centred, rising from the neckline', () => {
    const c = teeOnCanvas();
    const { mask, cx, top, width } = c;
    const hw = Math.round(0.4 * width);
    const hh = Math.round(0.14 * width);
    fillRect(mask, cx - Math.floor(hw / 2), top - hh, hw, hh + 70);
    const before = Uint8Array.from(mask.alpha);
    const result = removeHanger(mask);
    expect(same(result.alpha, before)).toBe(true);
  });

  it('keeps a hood that has a hanger hook on it, but still drops the hook', () => {
    const c = teeOnCanvas();
    const { mask, cx, top, width } = c;
    const hw = Math.round(0.4 * width);
    const hh = Math.round(0.14 * width);
    fillRect(mask, cx - Math.floor(hw / 2), top - hh, hw, hh + 70);
    fillRect(mask, cx - 1, top - hh - 70, 3, 72);
    const result = removeHanger(mask);
    const hood = (y: number, x: number): number => result.alpha[y * mask.width + x] as number;
    expect(hood(top - Math.round(hh / 2), cx)).toBe(255);
    expect(hood(top - hh - 40, cx)).toBe(0);
  });

  it('keeps a funnel-neck collar and a thicker standing band collar', () => {
    for (const [wFrac, hFrac] of [
      [0.26, 0.07],
      [0.32, 0.05],
    ] as const) {
      const c = teeOnCanvas();
      const { mask, cx, top, width } = c;
      const cw = Math.round(wFrac * width);
      const ch = Math.round(hFrac * width);
      fillRect(mask, cx - Math.floor(cw / 2), top - ch, cw, ch + 70);
      const before = Uint8Array.from(mask.alpha);
      expect(same(removeHanger(mask).alpha, before)).toBe(true);
    }
  });

  it('keeps thin camisole straps standing above a bodice (not in the middle)', () => {
    const g = garmentMask('sleevelessTop', { height: 480, margin: 10 });
    const room = 80;
    const alpha = new Uint8Array(g.mask.width * (g.mask.height + room));
    alpha.set(g.mask.alpha, room * g.mask.width);
    const m: AlphaMask = { width: g.mask.width, height: g.mask.height + room, alpha };
    let top = -1;
    for (let i = 0; i < alpha.length && top < 0; i++) if (alpha[i]) top = Math.floor(i / m.width);
    const mid = Math.round(m.width / 2);
    const gap = Math.round(0.22 * m.width);
    fillRect(m, mid - gap, top - 50, 3, 70);
    fillRect(m, mid + gap, top - 50, 3, 70);
    const before = Uint8Array.from(alpha);
    expect(same(removeHanger(m).alpha, before)).toBe(true);
  });

  it('does nothing when the removal would be a big part of the garment', () => {
    // A garment whose "thin" middle is most of it: a thin tall plank.
    const alpha = new Uint8Array(200 * 400);
    fillRect({ width: 200, height: 400, alpha }, 95, 10, 4, 380);
    const result = removeHanger({ width: 200, height: 400, alpha });
    expect(same(result.alpha, alpha)).toBe(true);
  });

  it('handles empty and tiny masks', () => {
    expect(removeHanger({ width: 0, height: 0, alpha: new Uint8Array(0) }).removedPixels).toBe(0);
    const empty = removeHanger({ width: 40, height: 40, alpha: new Uint8Array(1600) });
    expect(empty.removedPixels).toBe(0);
    const dot = new Uint8Array(1600);
    dot[20 * 40 + 20] = 255;
    expect(removeHanger({ width: 40, height: 40, alpha: dot }).removedPixels).toBe(0);
  });

  it('works on big masks too (the cutout service works at up to 2048 px)', () => {
    const c = teeOnCanvas(1600, 500);
    const { mask, cx, top } = c;
    fillRect(mask, cx - 4, top - 300, 9, 320);
    const result = removeHanger(mask);
    expect(opaqueAbove({ ...mask, alpha: result.alpha }, top)).toBe(0);
  });

  it('exposes its rules', () => {
    expect(HANGER_RULES.openFraction).toBeLessThan(HANGER_RULES.headMaxWidth);
  });
});

describe('removeHangerFromRgba', () => {
  it('clears the alpha of the hanger in place and returns how many pixels', () => {
    const c = teeOnCanvas();
    addWireHook(c);
    const { width, height, alpha } = c.mask;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < alpha.length; i++) {
      rgba[i * 4] = 200;
      rgba[i * 4 + 3] = alpha[i] as number;
    }
    const n = removeHangerFromRgba(rgba, width, height);
    expect(n).toBeGreaterThan(200);
    for (let y = 0; y < c.top; y++) {
      for (let x = 0; x < width; x++) expect(rgba[(y * width + x) * 4 + 3]).toBe(0);
    }
  });
});
