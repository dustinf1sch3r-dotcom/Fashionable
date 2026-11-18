import { garmentMask, type GarmentName } from '../testing/garmentMasks';
import { assessCapture, countPieces, hasTopBar } from './capture';
import type { AlphaMask } from './contract';
import { edgeContact } from './contact';
import { KIND, NAMES } from './testHelpers';

function blank(w: number, h: number): AlphaMask {
  return { width: w, height: h, alpha: new Uint8Array(w * h) };
}

function fill(m: AlphaMask, x: number, y: number, w: number, h: number): void {
  for (let yy = Math.max(0, y); yy < Math.min(m.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(m.width, x + w); xx++) {
      (m.alpha as Uint8Array)[yy * m.width + xx] = 255;
    }
  }
}

/** `src` copied into `dst` with its top-left corner at (ox, oy). */
function paste(dst: AlphaMask, src: AlphaMask, ox: number, oy: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (src.alpha[y * src.width + x])
        (dst.alpha as Uint8Array)[(y + oy) * dst.width + x + ox] = 255;
    }
  }
}

/** Rows `from`..`to` (fractions of the height) of a mask, as a new mask (a cropped photo). */
function cropRows(m: AlphaMask, from: number, to: number): AlphaMask {
  const y0 = Math.round(from * m.height);
  const y1 = Math.round(to * m.height);
  return { width: m.width, height: y1 - y0, alpha: m.alpha.slice(y0 * m.width, y1 * m.width) };
}

describe('edgeContact', () => {
  it('finds the sides a garment reaches', () => {
    const m = blank(100, 100);
    fill(m, 0, 20, 100, 60); // reaches left and right
    expect(edgeContact(m)).toEqual({
      top: false,
      bottom: false,
      left: true,
      right: true,
      sides: 2,
    });
    const n = blank(100, 100);
    fill(n, 30, 0, 40, 100);
    expect(edgeContact(n)).toMatchObject({ top: true, bottom: true, left: false, right: false });
  });

  it('ignores a speck on the border and handles empty or broken masks', () => {
    const m = blank(100, 100);
    fill(m, 20, 20, 60, 60);
    fill(m, 50, 0, 1, 2);
    expect(edgeContact(m).sides).toBe(0);
    expect(edgeContact(blank(0, 0)).sides).toBe(0);
    expect(edgeContact({ width: 10, height: 10, alpha: new Uint8Array(3) }).sides).toBe(0);
  });
});

describe('assessCapture', () => {
  it.each(NAMES)('%s: a clean, whole garment has no problems', (name) => {
    for (const rotate of [0, 4]) {
      const g = garmentMask(name, { rotate, height: 256 });
      expect(assessCapture(g.mask, KIND[name])).toEqual([]);
    }
  });

  it.each(NAMES)('%s: a garment touching the photo edge is cut off', (name) => {
    const g = garmentMask(name, { margin: 0, height: 256 });
    expect(assessCapture(g.mask, KIND[name])[0]).toBe('cut-off');
  });

  it('shoes and other unrigged items only get the edge check', () => {
    const two = blank(200, 100);
    fill(two, 10, 30, 70, 40);
    fill(two, 120, 30, 70, 40);
    expect(assessCapture(two, undefined)).toEqual([]);
    fill(two, 0, 40, 10, 20);
    expect(assessCapture(two, undefined)).toEqual(['cut-off']);
  });

  it('a tee cropped at the chest is cut off', () => {
    const g = garmentMask('tee', { height: 400 });
    expect(assessCapture(cropRows(g.mask, 0, 0.6), 'top')).toContain('cut-off');
  });

  it('two garments in one photo are several pieces', () => {
    const tee = garmentMask('tee', { height: 200 }).mask;
    const jeans = garmentMask('jeans', { height: 200 }).mask;
    const both = blank(tee.width + jeans.width + 20, 220);
    paste(both, tee, 0, 5);
    paste(both, jeans, tee.width + 20, 5);
    expect(countPieces(both)).toBe(2);
    expect(assessCapture(both, 'top')).toContain('several-pieces');
    expect(countPieces(tee)).toBe(1);
  });

  it('a small speck is not a second piece', () => {
    const tee = garmentMask('tee', { height: 240 }).mask;
    fill(tee, 2, 2, 4, 4);
    expect(countPieces(tee)).toBe(1);
  });

  it('a garment on a clothes rail is several pieces', () => {
    const g = garmentMask('coat', { height: 400, margin: 10 });
    const { width, height, alpha } = g.mask;
    const room = 70;
    const m = blank(width, height + room);
    m.alpha.set(alpha, room * width);
    const cx = Math.round(width / 2);
    // The rail: a bar 40% of the garment's width and 14 px tall at the very top.
    fill(m, cx - Math.round(0.2 * width), 4, Math.round(0.4 * width), 14);
    // Hooks down to the shoulders, thin.
    for (const dx of [-30, -10, 10, 30]) fill(m, cx + dx, 18, 3, room + 6);
    expect(hasTopBar(m)).toBe(true);
    expect(assessCapture(m, 'top')).toContain('several-pieces');
  });

  it('a wire hook, a hood and a collar are not a rail', () => {
    const base = (): AlphaMask => {
      const g = garmentMask('tee', { height: 400, margin: 10 });
      const m = blank(g.mask.width, g.mask.height + 120);
      m.alpha.set(g.mask.alpha, 120 * g.mask.width);
      return m;
    };
    const hook = base();
    fill(hook, Math.round(hook.width / 2) - 1, 20, 3, 130);
    expect(hasTopBar(hook)).toBe(false);
    const hood = base();
    fill(hood, Math.round(hood.width / 2) - 80, 70, 160, 110);
    expect(hasTopBar(hood)).toBe(false);
    const collar = base();
    fill(collar, Math.round(collar.width / 2) - 50, 95, 100, 90);
    expect(hasTopBar(collar)).toBe(false);
    for (const name of NAMES)
      expect(hasTopBar(garmentMask(name, { height: 256 }).mask)).toBe(false);
  });

  it('trousers with no gap between the legs are folded', () => {
    for (const name of ['jeans', 'wideLeg', 'shorts'] as GarmentName[]) {
      const g = garmentMask(name, { height: 300 });
      const m: AlphaMask = { ...g.mask, alpha: Uint8Array.from(g.mask.alpha) };
      // Close the gap: every row becomes one run from its first to its last opaque pixel.
      for (let y = 0; y < m.height; y++) {
        let a = -1;
        let b = -1;
        for (let x = 0; x < m.width; x++) {
          if (m.alpha[y * m.width + x]) {
            if (a < 0) a = x;
            b = x;
          }
        }
        if (a >= 0) fill(m, a, y, b - a + 1, 1);
      }
      expect(assessCapture(m, 'trousers')).toContain('folded');
      expect(assessCapture(g.mask, 'trousers')).toEqual([]);
    }
  });

  it('a top with neither sleeves nor a neck is folded', () => {
    const m = blank(200, 260);
    fill(m, 30, 20, 140, 220); // a plain folded rectangle
    expect(assessCapture(m, 'top')).toContain('folded');
    expect(assessCapture(m, 'dress')).toContain('folded');
  });

  it('a sleeveless top with a neck dip is not folded', () => {
    expect(assessCapture(garmentMask('sleevelessTop', { height: 256 }).mask, 'top')).toEqual([]);
  });

  it('reports a garment it cannot read as unclear when nothing more specific applies', () => {
    // One sleeve only: sleeves are found, but the outline is lopsided and the rig is not trusted.
    const g = garmentMask('tee', { height: 300 });
    const m: AlphaMask = { ...g.mask, alpha: Uint8Array.from(g.mask.alpha) };
    const armpit = g.truth.armpitR;
    if (!armpit) throw new Error('the tee fixture has no right armpit');
    const cut = Math.round(armpit.x * m.width);
    for (let y = 0; y < m.height; y++) {
      for (let x = cut; x < m.width; x++) (m.alpha as Uint8Array)[y * m.width + x] = 0;
    }
    expect(assessCapture(m, 'top')).toEqual(['unclear']);
  });

  it('is deterministic and never throws on empty or tiny masks', () => {
    for (const kind of ['top', 'trousers', 'skirt', 'dress', 'jumpsuit', undefined] as const) {
      expect(() => assessCapture(blank(0, 0), kind)).not.toThrow();
      expect(() => assessCapture(blank(30, 30), kind)).not.toThrow();
    }
    const g = garmentMask('tee', { noise: 0.5, seed: 3 }).mask;
    expect(assessCapture(g, 'top')).toEqual(assessCapture(g, 'top'));
  });
});
