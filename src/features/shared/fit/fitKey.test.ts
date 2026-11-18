import type { FitBody, GarmentRig } from '@/core/model/types';
import { BODY_A } from '@/core/tryon/bodies';
import { bodySignature, fitDensity, fitKey, fitSlotOf, hashString, rigSignature } from './fitKey';

const rig = (over: Partial<GarmentRig> = {}): GarmentRig => ({
  kind: 'top',
  version: 1,
  points: { neckL: { x: 0.4, y: 0.1 }, neckR: { x: 0.6, y: 0.1 } },
  confidence: 0.9,
  edited: false,
  ...over,
});

describe('fitSlotOf', () => {
  it('maps fitted categories to their slot and leaves the rest rigid', () => {
    expect(fitSlotOf({ category: 'top', subcategory: 'tshirt' })).toBe('base');
    expect(fitSlotOf({ category: 'top', subcategory: 'sweater' })).toBe('mid');
    expect(fitSlotOf({ category: 'bottom', subcategory: 'jeans' })).toBe('bottom');
    expect(fitSlotOf({ category: 'onepiece', subcategory: 'dress' })).toBe('onepiece');
    expect(fitSlotOf({ category: 'outerwear', subcategory: 'coat' })).toBe('outer');
    expect(fitSlotOf({ category: 'shoes', subcategory: 'sneakers' })).toBeUndefined();
    expect(fitSlotOf({ category: 'bag', subcategory: 'tote' })).toBeUndefined();
  });
});

describe('signatures', () => {
  it('hashString is stable and sensitive', () => {
    expect(hashString('a')).toBe(hashString('a'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('')).toHaveLength(8);
  });

  it('rigSignature changes with points, version and the edited flag only', () => {
    const base = rigSignature(rig());
    expect(rigSignature(rig({ confidence: 0.1 }))).toBe(base);
    expect(rigSignature(rig({ edited: true }))).not.toBe(base);
    expect(rigSignature(rig({ version: 2 }))).not.toBe(base);
    expect(
      rigSignature(rig({ points: { neckL: { x: 0.45, y: 0.1 }, neckR: { x: 0.6, y: 0.1 } } })),
    ).not.toBe(base);
    // property order does not matter
    expect(
      rigSignature(rig({ points: { neckR: { x: 0.6, y: 0.1 }, neckL: { x: 0.4, y: 0.1 } } })),
    ).toBe(base);
  });

  it('bodySignature follows landmarks and elbows', () => {
    const body: FitBody = { ...BODY_A.landmarks };
    const sig = bodySignature(body);
    expect(bodySignature({ ...BODY_A.landmarks })).toBe(sig);
    expect(bodySignature({ ...body, shoulderL: { x: 300, y: 400 } })).not.toBe(sig);
    expect(bodySignature({ ...body, elbowL: { x: 250, y: 700 } })).not.toBe(sig);
  });
});

describe('fitDensity', () => {
  it('picks 0.5, 0.75 or 1 pixel per unit', () => {
    expect(fitDensity(200, 1)).toBe(0.5);
    expect(fitDensity(300, 2)).toBe(0.75);
    expect(fitDensity(300, 3)).toBe(1);
    expect(fitDensity(500, 3)).toBe(1);
  });
});

describe('fitKey', () => {
  const parts = {
    itemId: 'i1',
    cutoutId: 'c1',
    rig: rig(),
    bodySig: 'abc',
    slot: 'base' as const,
    density: 0.75,
  };
  it('differs when any part differs', () => {
    const k = fitKey(parts);
    expect(fitKey({ ...parts })).toBe(k);
    for (const change of [
      { itemId: 'i2' },
      { cutoutId: 'c2' },
      { rig: rig({ edited: true }) },
      { bodySig: 'abd' },
      { slot: 'mid' as const },
      { density: 1 },
    ]) {
      expect(fitKey({ ...parts, ...change })).not.toBe(k);
    }
  });
});
