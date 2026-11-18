import { fixtureCloset } from '../../testing/fixtures';
import type { Occasion } from '../../model/types';
import { OCCASION_RULES } from '../weights';
import { outfit, tweak } from '../testUtils';
import { isItemAllowedForOccasion, occasionSkipsSlot, scoreOccasion } from './occasion';

const withFormality = (f: 1 | 2 | 3 | 4 | 5) => [
  tweak('tee-white', { formality: f }),
  tweak('jeans-dark', { formality: f }),
  tweak('sneakers-white', { formality: f }),
];

describe('isItemAllowedForOccasion (§5 table)', () => {
  const ranges: [Occasion, number, number][] = [
    ['any', 1, 5],
    ['lounge', 1, 2],
    ['casual', 1, 3],
    ['work', 3, 4],
    ['smart', 3, 4],
    ['formal', 4, 5],
  ];
  for (const [occ, min, max] of ranges) {
    it(`${occ}: allows formality ${min}–${max} only`, () => {
      for (const f of [1, 2, 3, 4, 5] as const) {
        const item = tweak('tee-white', { formality: f, sporty: false });
        expect(isItemAllowedForOccasion(item, occ)).toBe(f >= min && f <= max);
      }
    });
  }

  it('sporty items are only allowed for active, lounge and any', () => {
    const sporty = tweak('tee-white', { formality: 2, sporty: true });
    for (const o of ['active', 'lounge', 'any'] as const) {
      expect(isItemAllowedForOccasion(sporty, o)).toBe(true);
    }
    for (const o of ['casual', 'work', 'smart', 'formal'] as const) {
      expect(isItemAllowedForOccasion(sporty, o)).toBe(false);
    }
  });
  it('active: formality 1–2 and sporty only', () => {
    expect(
      isItemAllowedForOccasion(tweak('tee-white', { formality: 1, sporty: true }), 'active'),
    ).toBe(true);
    expect(
      isItemAllowedForOccasion(tweak('tee-white', { formality: 2, sporty: true }), 'active'),
    ).toBe(true);
    expect(
      isItemAllowedForOccasion(tweak('tee-white', { formality: 3, sporty: true }), 'active'),
    ).toBe(false);
    expect(
      isItemAllowedForOccasion(tweak('tee-white', { formality: 1, sporty: false }), 'active'),
    ).toBe(false);
  });
  it('active: belt, jewelry and neck slots are skipped even if sporty', () => {
    for (const id of ['belt-black-leather', 'necklace-gold', 'scarf-wool-red']) {
      expect(isItemAllowedForOccasion(tweak(id, { formality: 1, sporty: true }), 'active')).toBe(
        false,
      );
    }
    expect(occasionSkipsSlot('active', 'belt')).toBe(true);
    expect(occasionSkipsSlot('active', 'shoes')).toBe(false);
    expect(occasionSkipsSlot('casual', 'belt')).toBe(false);
  });
  it('fixture closet: running shoes pass active, tee does not', () => {
    const closet = fixtureCloset();
    const ok = closet.filter((i) => isItemAllowedForOccasion(i, 'active')).map((i) => i.id);
    expect(ok).toContain('running-shoes-grey');
    expect(ok).not.toContain('tee-white');
  });
});

describe('scoreOccasion (§5 formula)', () => {
  it('any → skipped', () => {
    expect(scoreOccasion(outfit('tee-white', 'jeans-dark'), 'any')).toBeNull();
    expect(OCCASION_RULES.any.ideal).toBeNull();
  });
  it('is null without main pieces', () => {
    expect(scoreOccasion(outfit('watch-silver'), 'casual')).toBeNull();
  });
  const ideals: [Occasion, number][] = [
    ['lounge', 1],
    ['casual', 2],
    ['active', 1],
    ['work', 3.5],
    ['smart', 3.5],
    ['formal', 4.5],
  ];
  it('table ideals are as specified', () => {
    for (const [occ, ideal] of ideals) expect(OCCASION_RULES[occ].ideal).toBe(ideal);
  });
  it('mean on the ideal → 1', () => {
    const items = [
      tweak('tee-white', { formality: 3 }),
      tweak('trousers-black', { formality: 4 }),
      tweak('shirt-oxford-white', { formality: 3 }),
      tweak('loafers-brown', { formality: 4 }),
    ];
    expect(scoreOccasion(items, 'work')?.value).toBe(1);
  });
  it('1 − |mean − ideal| / 2', () => {
    expect(scoreOccasion(withFormality(3), 'casual')?.value).toBe(0.5);
    expect(scoreOccasion(withFormality(2), 'casual')?.value).toBe(1);
    expect(scoreOccasion(withFormality(5), 'lounge')?.value).toBe(0);
    expect(scoreOccasion(withFormality(1), 'formal')?.value).toBe(0);
    expect(scoreOccasion(withFormality(4), 'formal')?.value).toBe(0.75);
  });
  it('ignores non-main pieces', () => {
    const items = [...withFormality(2), tweak('blazer-navy', { formality: 5 })];
    expect(scoreOccasion(items, 'casual')?.value).toBe(1);
  });
});
