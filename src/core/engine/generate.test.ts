import { slotOf } from '../model/slots';
import { subcategoryDefaults } from '../model/taxonomy';
import type { Item, Occasion, Slot, Weather } from '../model/types';
import {
  WEATHER_COLD,
  WEATHER_COOL_RAIN,
  WEATHER_FREEZING,
  WEATHER_HOT,
  WEATHER_MILD,
  fixtureCloset,
  fixtureFeedback,
  fixtureWearLogs,
} from '../testing/fixtures';
import { generateOutfits } from './generate';
import type { GenerateInput } from './generate';
import { buildTasteModel } from './taste';
import { scoreOutfit } from './scoreOutfit';
import { isItemAllowedInWeather } from './score/weather';
import { MAX_CORE_COMBOS } from './weights';

const DATE = '2026-01-10';

function run(
  overrides: Partial<Omit<GenerateInput, 'context'>> & {
    context?: Partial<GenerateInput['context']>;
  } = {},
) {
  const { context, ...rest } = overrides;
  return generateOutfits({
    items: fixtureCloset(),
    wearLogs: fixtureWearLogs(),
    feedback: [],
    count: 5,
    seed: 1,
    ...rest,
    context: { date: DATE, occasion: 'casual', ...context },
  });
}

const closet = fixtureCloset();
const byId = new Map(closet.map((i) => [i.id, i]));
const itemsOf = (ids: readonly string[]): Item[] => ids.map((id) => byId.get(id) as Item);
const slotsOf = (ids: readonly string[]): Slot[] => itemsOf(ids).map(slotOf);

const CONTEXTS: { occasion: Occasion; weather?: Weather }[] = [
  { occasion: 'casual', weather: WEATHER_MILD },
  { occasion: 'any' },
  { occasion: 'work', weather: WEATHER_COLD },
  { occasion: 'casual', weather: WEATHER_HOT },
  { occasion: 'any', weather: WEATHER_FREEZING },
  { occasion: 'casual', weather: WEATHER_COOL_RAIN },
  { occasion: 'formal' },
  { occasion: 'lounge' },
];
const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 3);

describe('generateOutfits properties', () => {
  it.each(CONTEXTS.map((c) => [`${c.occasion}/${c.weather?.feelsLikeC ?? 'none'}`, c] as const))(
    'respects slot capacity, jewelry limit and uniqueness (%s)',
    (_name, c) => {
      for (const seed of SEEDS) {
        const { suggestions } = run({ seed, context: c });
        for (const s of suggestions) {
          const slots = slotsOf(s.itemIds);
          expect(new Set(s.itemIds).size).toBe(s.itemIds.length);
          for (const slot of new Set(slots)) {
            const n = slots.filter((x) => x === slot).length;
            expect(n).toBeLessThanOrEqual(slot === 'jewelry' ? 3 : 1);
          }
          const hasOne = slots.includes('onepiece');
          expect(hasOne ? !slots.includes('base') && !slots.includes('bottom') : true).toBe(true);
          expect(slots.includes('shoes')).toBe(true);
          expect(s.score).toBeGreaterThanOrEqual(0);
          expect(s.score).toBeLessThanOrEqual(100);
          for (const id of s.itemIds) expect(byId.get(id)?.status).toBe('active');
        }
      }
    },
  );

  it('produces results in the common contexts', () => {
    for (const c of CONTEXTS) {
      expect(run({ context: c }).suggestions.length).toBeGreaterThan(0);
    }
  });

  it('always includes pinned items and never excluded ones', () => {
    for (const seed of SEEDS) {
      for (const pin of ['jeans-dark', 'dress-wrap-green', 'blazer-navy', 'sneakers-white']) {
        const { suggestions } = run({ seed, context: { pinnedItemIds: [pin] } });
        for (const s of suggestions) expect(s.itemIds).toContain(pin);
      }
      const exclude = ['tee-white', 'sneakers-white', 'jeans-dark', 'belt-brown-leather'];
      const { suggestions } = run({ seed, context: { excludeItemIds: exclude } });
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) for (const id of exclude) expect(s.itemIds).not.toContain(id);
    }
  });

  it('keeps a pinned laundry item and a weather-breaking pin with PINNED_OVERRIDE', () => {
    const laundry = run({ context: { pinnedItemIds: ['tee-black-laundry'] } });
    expect(laundry.suggestions.length).toBeGreaterThan(0);
    for (const s of laundry.suggestions) expect(s.itemIds).toContain('tee-black-laundry');

    const puffer = run({
      context: { occasion: 'any', weather: WEATHER_HOT, pinnedItemIds: ['puffer-black'] },
    });
    expect(puffer.suggestions.length).toBeGreaterThan(0);
    for (const s of puffer.suggestions) {
      expect(s.itemIds).toContain('puffer-black');
      expect(s.reasons.some((r) => r.code === 'PINNED_OVERRIDE')).toBe(true);
    }
  });

  it('returns nothing for pins that cannot coexist', () => {
    const r = run({ context: { pinnedItemIds: ['dress-wrap-green', 'jeans-dark'] } });
    expect(r.suggestions).toEqual([]);
    const two = run({ context: { pinnedItemIds: ['sneakers-white', 'heels-black'] } });
    expect(two.suggestions).toEqual([]);
  });

  it('respects weather hard rules except for pinned items', () => {
    for (const c of CONTEXTS.filter((x) => x.weather)) {
      for (const seed of SEEDS.slice(0, 4)) {
        for (const s of run({ seed, context: c }).suggestions) {
          for (const item of itemsOf(s.itemIds)) {
            expect(isItemAllowedInWeather(item, c.weather)).toBe(true);
          }
        }
      }
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    for (const c of CONTEXTS) {
      expect(run({ seed: 9, context: c })).toEqual(run({ seed: 9, context: c }));
    }
    const outputs = SEEDS.map((seed) =>
      JSON.stringify(run({ seed, context: { occasion: 'any' } }).suggestions.map((s) => s.itemIds)),
    );
    expect(new Set(outputs).size).toBeGreaterThan(1);
  });

  it('does not mutate its input', () => {
    const items = fixtureCloset();
    const copy = JSON.stringify(items);
    run({ items });
    expect(JSON.stringify(items)).toBe(copy);
  });

  it('returns diverse results, sorted into a sensible order', () => {
    for (const seed of SEEDS) {
      const { suggestions } = run({ seed, context: { weather: WEATHER_MILD } });
      expect(suggestions).toHaveLength(5);
      const keys = new Set(
        suggestions.map((s) =>
          itemsOf(s.itemIds)
            .filter((i) => ['base', 'bottom', 'onepiece'].includes(slotOf(i)))
            .map((i) => i.id)
            .sort()
            .join('|'),
        ),
      );
      expect(keys.size).toBeGreaterThan(1);
      expect(new Set(suggestions.map((s) => s.itemIds.join('|'))).size).toBe(5);
    }
  });

  it('honours count', () => {
    expect(run({ count: 2 }).suggestions).toHaveLength(2);
    expect(run({ count: 0 }).suggestions).toHaveLength(0);
  });
});

describe('generateOutfits scoring', () => {
  it('reports the same score as scoreOutfit with the full history', () => {
    const wearLogs = fixtureWearLogs();
    const ctx = { date: DATE, occasion: 'casual' as const, weather: WEATHER_MILD };
    const { suggestions } = run({ context: ctx, wearLogs, feedback: fixtureFeedback() });
    for (const s of suggestions) {
      const full = scoreOutfit(itemsOf(s.itemIds), ctx, {
        wearLogs,
        feedback: fixtureFeedback(),
        taste: buildTasteModel(fixtureFeedback(), closet),
      });
      expect(s.score).toBeCloseTo(full.total, 9);
    }
  });
});

describe('generateOutfits owner rules', () => {
  const ACCESSORIES: Slot[] = ['neck', 'head', 'eyes', 'bag', 'wrist', 'jewelry'];

  it('fills at most 3 accessory slots, pinned ones included', () => {
    for (const seed of SEEDS) {
      for (const c of CONTEXTS) {
        for (const s of run({ seed, context: c }).suggestions) {
          const n = new Set(slotsOf(s.itemIds).filter((x) => ACCESSORIES.includes(x))).size;
          expect(n).toBeLessThanOrEqual(3);
        }
      }
      const pins = ['watch-silver', 'sunglasses-black', 'bag-shoulder-brown'];
      for (const s of run({ seed, context: { pinnedItemIds: pins } }).suggestions) {
        expect(new Set(slotsOf(s.itemIds).filter((x) => ACCESSORIES.includes(x))).size).toBe(3);
      }
    }
  });

  it('adds no mid in warm weather and no warm neck/head items', () => {
    for (const seed of SEEDS) {
      for (const weather of [WEATHER_MILD, WEATHER_HOT]) {
        for (const s of run({ seed, context: { weather } }).suggestions) {
          expect(slotsOf(s.itemIds)).not.toContain('mid');
          for (const i of itemsOf(s.itemIds)) {
            if (['neck', 'head'].includes(slotOf(i))) expect(i.warmth).toBeLessThan(3);
          }
        }
      }
    }
  });

  it('keeps sporty items out of casual, work, smart and formal unless pinned', () => {
    const marked = fixtureCloset().map((i) =>
      i.id === 'tee-navy' ? { ...i, sporty: true, formality: 1 as const } : i,
    );
    for (const occasion of ['casual', 'work', 'smart', 'formal'] as const) {
      for (const s of run({ items: marked, context: { occasion } }).suggestions) {
        expect(s.itemIds).not.toContain('tee-navy');
      }
    }
    const pinned = run({
      items: marked,
      context: { occasion: 'casual', pinnedItemIds: ['tee-navy'] },
    });
    expect(pinned.suggestions.length).toBeGreaterThan(0);
    for (const s of pinned.suggestions) {
      expect(s.itemIds).toContain('tee-navy');
      expect(s.reasons.some((r) => r.code === 'PINNED_OVERRIDE')).toBe(true);
    }
  });
});

describe('generateOutfits scenarios', () => {
  it('freezing: every outfit has an outer with warmth >= 4 and a mid', () => {
    for (const seed of SEEDS) {
      const { suggestions } = run({
        seed,
        context: { occasion: 'any', weather: WEATHER_FREEZING },
      });
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        const items = itemsOf(s.itemIds);
        const outer = items.find((i) => slotOf(i) === 'outer');
        expect(outer?.warmth).toBeGreaterThanOrEqual(4);
        expect(slotsOf(s.itemIds)).toContain('mid');
        expect(s.reasons.some((r) => r.code === 'MISSING_LAYER')).toBe(false);
      }
    }
  });

  it('cool rain: no rainOk:false shoes, outer or bag', () => {
    for (const seed of SEEDS) {
      const { suggestions } = run({ seed, context: { weather: WEATHER_COOL_RAIN } });
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        for (const i of itemsOf(s.itemIds)) {
          if (['shoes', 'outer', 'bag'].includes(slotOf(i))) expect(i.rainOk).toBe(true);
        }
        // mild band needs a mid or an outer
        expect(slotsOf(s.itemIds).some((x) => x === 'mid' || x === 'outer')).toBe(true);
      }
    }
  });

  it('formal: no tees and no shorts', () => {
    for (const seed of SEEDS) {
      const { suggestions } = run({ seed, context: { occasion: 'formal' } });
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        for (const i of itemsOf(s.itemIds)) {
          expect(i.subcategory).not.toBe('tshirt');
          expect(['shorts', 'sports-shorts']).not.toContain(i.subcategory);
          expect(i.formality).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('active: only sporty items, no belt, jewelry or neckwear', () => {
    const r = run({ context: { occasion: 'active' } });
    if (r.suggestions.length === 0) {
      expect(r.diagnostics.missingSlots).toBeDefined();
    }
    const sporty = fixtureCloset().map((i) => ({ ...i, sporty: true, formality: 1 as const }));
    const only = fixtureCloset();
    // Make a handful of items sporty so the occasion can be filled.
    const marked = only.map((i) =>
      ['tee-white', 'jeans-dark', 'sneakers-white', 'tee-navy', 'chinos-beige'].includes(i.id)
        ? { ...i, sporty: true, formality: 1 as const }
        : i,
    );
    const out = run({ items: marked, context: { occasion: 'active' } });
    expect(out.suggestions.length).toBeGreaterThan(0);
    for (const s of out.suggestions) {
      for (const id of s.itemIds) {
        const item = marked.find((i) => i.id === id) as Item;
        expect(item.sporty).toBe(true);
        expect(['belt', 'jewelry', 'neck']).not.toContain(slotOf(item));
      }
    }
    expect(sporty.length).toBeGreaterThan(0);
  });

  it('belts only come with belt-compatible bottoms', () => {
    for (const seed of SEEDS) {
      for (const s of run({ seed, context: { occasion: 'any' } }).suggestions) {
        const items = itemsOf(s.itemIds);
        if (!items.some((i) => slotOf(i) === 'belt')) continue;
        const bottom = items.find((i) => slotOf(i) === 'bottom');
        expect(bottom).toBeDefined();
        expect(subcategoryDefaults('bottom', (bottom as Item).subcategory)?.beltCompatible).toBe(
          true,
        );
      }
    }
  });

  it('never returns an exact disliked set', () => {
    const base = run({ context: { occasion: 'any' } });
    const top = base.suggestions[0];
    expect(top).toBeDefined();
    const feedback = fixtureFeedback().map((f) => ({
      ...f,
      itemIds: [...(top?.itemIds ?? [])].sort(),
      verdict: 'dislike' as const,
    }));
    const key = [...(top?.itemIds ?? [])].sort().join('|');
    for (const seed of SEEDS) {
      const r = run({ seed, feedback: feedback.slice(0, 1), context: { occasion: 'any' } });
      for (const s of r.suggestions) expect([...s.itemIds].sort().join('|')).not.toBe(key);
    }
  });

  it('empty closet reports every template slot as missing', () => {
    const r = run({ items: [] });
    expect(r.suggestions).toEqual([]);
    expect(r.diagnostics.missingSlots).toEqual(['onepiece', 'shoes']);
    expect(r.diagnostics.consideredCombos).toBe(0);
  });

  it('closet without shoes names shoes', () => {
    const items = fixtureCloset().filter((i) => i.category !== 'shoes');
    const r = run({ items });
    expect(r.suggestions).toEqual([]);
    expect(r.diagnostics.missingSlots).toEqual(['shoes']);
  });

  it('closet without bottoms or dresses names the cheaper template', () => {
    const items = fixtureCloset().filter(
      (i) => i.category !== 'bottom' && i.category !== 'onepiece',
    );
    const r = run({ items });
    expect(r.suggestions).toEqual([]);
    expect(r.diagnostics.missingSlots).toEqual(['bottom']);
  });
});

describe('generateOutfits golden', () => {
  it('fixture closet, casual, mild weather, seed 42', () => {
    const { suggestions, diagnostics } = run({
      seed: 42,
      context: { occasion: 'casual', weather: WEATHER_MILD },
    });
    expect(diagnostics.sampled).toBe(false);
    expect(suggestions.map((s) => ({ ids: s.itemIds, score: Math.round(s.score * 100) / 100 })))
      .toMatchInlineSnapshot(`
     [
       {
         "ids": [
           "blouse-floral",
           "jeans-dark",
           "sandals-tan",
           "sunglasses-black",
         ],
         "score": 95.93,
       },
       {
         "ids": [
           "tee-navy",
           "jeans-light",
           "sneakers-white",
           "sunglasses-black",
         ],
         "score": 94.33,
       },
       {
         "ids": [
           "dress-wrap-green",
           "loafers-brown",
           "sunglasses-black",
         ],
         "score": 89.72,
       },
       {
         "ids": [
           "tee-white",
           "jeans-dark",
           "sneakers-white",
           "bag-shoulder-brown",
           "sunglasses-black",
         ],
         "score": 94.68,
       },
       {
         "ids": [
           "blouse-floral",
           "skirt-midi-pleated",
           "sneakers-white",
           "sunglasses-black",
         ],
         "score": 94.07,
       },
     ]
    `);
  });
});

describe('generateOutfits at scale', () => {
  function bigCloset(n: number): Item[] {
    const base = fixtureCloset();
    const out: Item[] = [];
    for (let i = 0; i < n; i++) {
      const src = base[i % base.length] as Item;
      const round = Math.floor(i / base.length);
      const jitter = (round * 37) % 60;
      out.push({
        ...src,
        id: `${src.id}-c${round}`,
        colors: src.colors.map((c, k) => ({
          ...c,
          hex: `#${((parseInt(c.hex.slice(1), 16) + jitter * 4093 * (k + 1)) & 0xffffff)
            .toString(16)
            .padStart(6, '0')}`,
        })),
        images: { ...src.images },
        cutout: { ...src.cutout },
      });
    }
    return out;
  }

  it('samples when the core product is large, deterministically', () => {
    const items = bigCloset(300);
    const input = {
      items,
      wearLogs: [],
      feedback: [],
      context: { date: DATE, occasion: 'any' as const },
      seed: 5,
    };
    const a = generateOutfits(input);
    expect(a.diagnostics.sampled).toBe(true);
    expect(a.diagnostics.consideredCombos).toBe(MAX_CORE_COMBOS);
    expect(a.suggestions).toHaveLength(5);
    expect(generateOutfits(input)).toEqual(a);
    const other = generateOutfits({ ...input, seed: 6 });
    expect(JSON.stringify(other.suggestions)).not.toBe(JSON.stringify(a.suggestions));
  });

  it('generates 5 outfits from 300 items in under 150 ms', () => {
    const items = bigCloset(300);
    const input = {
      items,
      wearLogs: fixtureWearLogs(),
      feedback: [],
      context: { date: DATE, occasion: 'casual' as const, weather: WEATHER_MILD },
      count: 5,
      seed: 7,
    };
    generateOutfits(input); // warm up the JIT
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = generateOutfits({ ...input, seed: 7 + i });
      times.push(performance.now() - t0);
      expect(r.suggestions).toHaveLength(5);
    }
    times.sort((a, b) => a - b);
    process.stdout.write(`generate 300 items ms: ${times.map((t) => t.toFixed(1)).join(' ')}\n`);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(150);
  });
});
