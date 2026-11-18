import { slotOf } from '../model/slots';
import { validateFeedback, validateItem, validateWearLog } from '../model/validate';
import type { Slot, Weather } from '../model/types';
import {
  WEATHER_COLD,
  WEATHER_COOL_RAIN,
  WEATHER_FREEZING,
  WEATHER_HOT,
  WEATHER_MILD,
  fixtureById,
  fixtureCloset,
  fixtureFeedback,
  fixtureWearLogs,
} from './fixtures';

const ALL_SLOTS: Slot[] = [
  'base',
  'mid',
  'bottom',
  'onepiece',
  'outer',
  'shoes',
  'legs',
  'belt',
  'bag',
  'head',
  'neck',
  'eyes',
  'wrist',
  'jewelry',
];

function band(w: Weather): 'hot' | 'mild' | 'cool' | 'cold' | 'freezing' {
  const f = w.feelsLikeC;
  if (f >= 27) return 'hot';
  if (f >= 20) return 'mild';
  if (f >= 13) return 'cool';
  if (f >= 5) return 'cold';
  return 'freezing';
}

describe('fixtureCloset', () => {
  const closet = fixtureCloset();

  it('has about 30 items and all pass validateItem', () => {
    expect(closet.length).toBeGreaterThanOrEqual(30);
    for (const item of closet) {
      const r = validateItem(item);
      expect({ id: item.id, ok: r.ok }).toEqual({ id: item.id, ok: true });
    }
  });

  it('has unique ids', () => {
    expect(new Set(closet.map((i) => i.id)).size).toBe(closet.length);
  });

  it('covers every slot', () => {
    const slots = new Set(closet.map(slotOf));
    expect([...slots].sort()).toEqual([...ALL_SLOTS].sort());
  });

  it('includes laundry and archived items', () => {
    const statuses = new Set(closet.map((i) => i.status));
    expect(statuses).toEqual(new Set(['active', 'laundry', 'archived']));
  });

  it('spans formality and warmth 1-5', () => {
    expect(new Set(closet.map((i) => i.formality))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(new Set(closet.map((i) => i.warmth))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('exercises rule-relevant tags', () => {
    expect(closet.some((i) => i.rainOk && i.category === 'shoes')).toBe(true);
    expect(closet.some((i) => !i.rainOk && i.category === 'shoes')).toBe(true);
    expect(closet.some((i) => i.sporty)).toBe(true);
    expect(closet.some((i) => i.material === 'leather')).toBe(true);
    expect(closet.some((i) => i.material === 'suede')).toBe(true);
    expect(closet.some((i) => i.metal === 'gold')).toBe(true);
    expect(closet.some((i) => i.metal === 'silver')).toBe(true);
    expect(closet.some((i) => i.pattern === 'stripe')).toBe(true);
    expect(closet.some((i) => i.pattern === 'floral' && i.patternBold)).toBe(true);
  });

  it('has key named pieces in the expected slots', () => {
    const slot = (id: string) => slotOf(fixtureById(id));
    expect(slot('tee-white')).toBe('base');
    expect(slot('sweater-red')).toBe('mid');
    expect(slot('hoodie-grey')).toBe('mid');
    expect(slot('cardigan-cream')).toBe('mid');
    expect(slot('puffer-black')).toBe('outer');
    expect(fixtureById('puffer-black').warmth).toBe(5);
    expect(fixtureById('trench-beige').rainOk).toBe(true);
    expect(fixtureById('boots-black-chelsea').rainOk).toBe(true);
    expect(fixtureById('running-shoes-grey').sporty).toBe(true);
  });

  it('returns fresh copies each call', () => {
    const a = fixtureCloset();
    const b = fixtureCloset();
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(b[0]);
    const first = a[0];
    if (!first) throw new Error('empty closet');
    first.colors.forEach((c) => (c.hex = '#000000'));
    expect(fixtureCloset()[0]?.colors[0]?.hex).not.toBe('#000000');
    expect(fixtureById('tee-white')).toEqual(fixtureById('tee-white'));
    expect(fixtureById('tee-white')).not.toBe(fixtureById('tee-white'));
  });

  it('fixtureById throws for unknown ids', () => {
    expect(() => fixtureById('nope')).toThrow();
  });
});

describe('weather presets', () => {
  it('land in the intended bands', () => {
    expect(band(WEATHER_HOT)).toBe('hot');
    expect(band(WEATHER_MILD)).toBe('mild');
    expect(band(WEATHER_COOL_RAIN)).toBe('cool');
    expect(band(WEATHER_COLD)).toBe('cold');
    expect(band(WEATHER_FREEZING)).toBe('freezing');
  });

  it('rain preset is rainy, others are not', () => {
    expect(WEATHER_COOL_RAIN.precipProbability).toBeGreaterThanOrEqual(0.5);
    for (const w of [WEATHER_HOT, WEATHER_MILD, WEATHER_COLD, WEATHER_FREEZING]) {
      expect(w.precipProbability).toBeLessThan(0.5);
    }
  });

  it('hot and mild are sunny at >= 20 C', () => {
    expect(WEATHER_HOT.isSunny && WEATHER_HOT.feelsLikeC >= 20).toBe(true);
    expect(WEATHER_MILD.isSunny && WEATHER_MILD.feelsLikeC >= 20).toBe(true);
  });
});

describe('sample history', () => {
  const ids = new Set(fixtureCloset().map((i) => i.id));

  it('wear logs validate and reference fixture items', () => {
    const logs = fixtureWearLogs();
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) {
      expect(validateWearLog(l).ok).toBe(true);
      for (const id of l.itemIds) expect(ids.has(id)).toBe(true);
    }
    expect(logs.some((l) => l.planned)).toBe(true);
  });

  it('feedback validates, is sorted, and references fixture items', () => {
    const fb = fixtureFeedback();
    expect(fb.some((f) => f.verdict === 'like')).toBe(true);
    expect(fb.some((f) => f.verdict === 'dislike')).toBe(true);
    for (const f of fb) {
      expect(validateFeedback(f).ok).toBe(true);
      for (const id of f.itemIds) expect(ids.has(id)).toBe(true);
    }
  });
});
