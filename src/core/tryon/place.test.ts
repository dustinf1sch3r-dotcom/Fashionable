import { anchorFor } from './anchors';
import { BODY_A } from './bodies';
import { clampFit, placeItem, placeOutfit } from './place';
import type { Category, FitAdjust, Item, Outfit } from '../model/types';

function item(id: string, category: Category, extra: Partial<Item> = {}): Item {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category,
    subcategory: 'x',
    colors: [],
    pattern: 'solid',
    patternBold: false,
    formality: 2,
    warmth: 3,
    rainOk: false,
    sporty: false,
    status: 'active',
    favorite: false,
    images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
    cutout: { aspectRatio: 2, hasAlpha: true },
    ...extra,
  };
}
function outfit(extra: Partial<Outfit> = {}): Outfit {
  return {
    id: 'o1',
    createdAt: '',
    updatedAt: '',
    itemIds: [],
    source: 'manual',
    favorite: false,
    ...extra,
  };
}
const fit = (p: Partial<FitAdjust>): FitAdjust => ({ dx: 0, dy: 0, scale: 1, rotation: 0, ...p });

describe('placeItem', () => {
  const tee = item('tee', 'top', { layer: 'base' });
  const a = anchorFor('base', BODY_A);

  it('uses anchor width, aspect ratio height and centres x', () => {
    const p = placeItem(tee, BODY_A);
    expect(p).toEqual({
      itemId: 'tee',
      width: a.width,
      height: a.width / 2,
      x: a.centerX - a.width / 2,
      y: a.topY,
      rotation: 0,
      z: 40,
    });
  });

  it('applies scale, dx, dy and rotation', () => {
    const p = placeItem(tee, BODY_A, fit({ scale: 1.5, dx: 20, dy: -10, rotation: 12 }));
    expect(p.width).toBeCloseTo(a.width * 1.5);
    expect(p.height).toBeCloseTo((a.width * 1.5) / 2);
    expect(p.x).toBeCloseTo(a.centerX - (a.width * 1.5) / 2 + 20);
    expect(p.y).toBeCloseTo(a.topY - 10);
    expect(p.rotation).toBe(12);
  });

  it('override beats item.fitAdjust beats identity', () => {
    const saved = item('t2', 'top', { layer: 'base', fitAdjust: fit({ scale: 1.2 }) });
    expect(placeItem(saved, BODY_A).width).toBeCloseTo(a.width * 1.2);
    expect(placeItem(saved, BODY_A, fit({ scale: 0.8 })).width).toBeCloseTo(a.width * 0.8);
    expect(placeItem(tee, BODY_A).width).toBeCloseTo(a.width);
  });

  it('clamps out-of-range adjustments', () => {
    const p = placeItem(tee, BODY_A, fit({ scale: 9, dx: 9999, dy: -9999, rotation: 90 }));
    expect(p.width).toBeCloseTo(a.width * 2);
    expect(p.y).toBeCloseTo(a.topY - 400);
    expect(p.x).toBeCloseTo(a.centerX - a.width + 400);
    expect(p.rotation).toBe(30);
  });
});

describe('clampFit', () => {
  it('leaves valid values alone', () => {
    const v = fit({ dx: 10, dy: -20, scale: 1.3, rotation: -5 });
    expect(clampFit(v)).toEqual(v);
  });
  it('clamps each field at both ends', () => {
    expect(clampFit({ dx: -500, dy: 500, scale: 0.1, rotation: -45 })).toEqual({
      dx: -400,
      dy: 400,
      scale: 0.5,
      rotation: -30,
    });
    expect(clampFit({ dx: 400, dy: -400, scale: 2, rotation: 30 })).toEqual({
      dx: 400,
      dy: -400,
      scale: 2,
      rotation: 30,
    });
  });
});

describe('placeOutfit', () => {
  const items = [
    item('bag', 'bag'),
    item('tee', 'top', { layer: 'base' }),
    item('jeans', 'bottom'),
    item('shoes', 'shoes'),
    item('coat', 'outerwear'),
    item('sock', 'legwear'),
    item('hat', 'headwear'),
    item('sweater', 'top', { layer: 'mid' }),
  ];
  const ids = (ps: { itemId: string }[]): string[] => ps.map((p) => p.itemId);

  it('sorts a full outfit by z', () => {
    const ps = placeOutfit(items, BODY_A);
    expect(ids(ps)).toEqual(['sock', 'shoes', 'jeans', 'tee', 'sweater', 'coat', 'bag', 'hat']);
    const zs = ps.map((p) => p.z);
    expect([...zs].sort((x, y) => x - y)).toEqual(zs);
  });

  it('draws a tucked base under the bottom', () => {
    const ps = placeOutfit(items, BODY_A, outfit({ tucked: true }));
    const tee = ps.find((p) => p.itemId === 'tee');
    expect(tee?.z).toBe(25);
    expect(ids(ps).indexOf('tee')).toBeLessThan(ids(ps).indexOf('jeans'));
    expect(ids(ps).indexOf('tee')).toBeGreaterThan(ids(ps).indexOf('shoes'));
  });

  it('does not tuck mid layers or one-pieces', () => {
    const ps = placeOutfit([item('d', 'onepiece'), items[7]], BODY_A, outfit({ tucked: true }));
    expect(ps.map((p) => p.z)).toEqual([40, 50]);
  });

  it('applies fitOverrides per item over the item fit', () => {
    const jeans = item('jeans', 'bottom', { fitAdjust: fit({ scale: 1.1 }) });
    const base = anchorFor('bottom', BODY_A).width;
    const [p] = placeOutfit(
      [jeans],
      BODY_A,
      outfit({ fitOverrides: { jeans: fit({ scale: 1.4 }) } }),
    );
    expect(p.width).toBeCloseTo(base * 1.4);
    const [q] = placeOutfit([jeans], BODY_A);
    expect(q.width).toBeCloseTo(base * 1.1);
  });

  it('spreads jewellery horizontally without stacking', () => {
    const js = [item('j1', 'jewelry'), item('j2', 'jewelry'), item('j3', 'jewelry')];
    const centres = placeOutfit(js, BODY_A).map((p) => p.x + p.width / 2);
    expect(centres).toEqual([460, 500, 540]);
    const two = placeOutfit(js.slice(0, 2), BODY_A).map((p) => p.x + p.width / 2);
    expect(two).toEqual([480, 520]);
    const one = placeOutfit(js.slice(0, 1), BODY_A).map((p) => p.x + p.width / 2);
    expect(one).toEqual([500]);
  });
});
