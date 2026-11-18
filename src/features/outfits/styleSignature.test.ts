import { fixtureCloset } from '@/core/testing';

import { styleSignature } from './styleSignature';

describe('styleSignature', () => {
  const closet = fixtureCloset();
  const base = styleSignature(closet);

  it('ignores garment points, placement tweaks, photos and timestamps', () => {
    const touched = closet.map((i, n) =>
      n === 0
        ? {
            ...i,
            updatedAt: '2030-01-01T00:00:00Z',
            fit: { kind: 'top' as const, version: 3, confidence: 0.9, edited: false, points: {} },
            fitAdjust: { dx: 4, dy: 0, scale: 1.1, rotation: 2 },
            images: { originalId: 'o2', cutoutId: 'c2', thumbId: 't2' },
          }
        : i,
    );
    expect(styleSignature(touched)).toBe(base);
  });

  it('changes when something the engine reads changes', () => {
    const first = closet[0];
    if (!first) throw new Error('fixture closet is empty');
    const variants = [
      { ...first, formality: first.formality === 5 ? (4 as const) : (5 as const) },
      { ...first, status: 'laundry' as const },
      { ...first, colors: [{ hex: '#ff0000', share: 1, name: 'red' as const }] },
    ];
    for (const v of variants) expect(styleSignature([v, ...closet.slice(1)])).not.toBe(base);
    expect(styleSignature(closet.slice(1))).not.toBe(base);
  });
});
