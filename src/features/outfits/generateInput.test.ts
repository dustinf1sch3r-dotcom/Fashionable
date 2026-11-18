import { generateOutfits } from '@/core/engine/generate';
import { fixtureCloset, WEATHER_MILD } from '@/core/testing/fixtures';
import { buildGenerateInput, newSeed, SUGGESTION_COUNT, todayISO } from './generateInput';

const base = {
  items: fixtureCloset(),
  wearLogs: [],
  feedback: [],
  occasion: 'casual' as const,
  date: '2026-11-18',
  pinnedItemIds: [] as string[],
  seed: 7,
};

describe('buildGenerateInput', () => {
  it('passes only active items and the requested context', () => {
    const input = buildGenerateInput({ ...base, weather: WEATHER_MILD });
    expect(input.items.length).toBeGreaterThan(0);
    expect(input.items.every((i) => i.status === 'active')).toBe(true);
    expect(input.items.length).toBeLessThan(base.items.length);
    expect(input.context).toEqual({
      date: '2026-11-18',
      occasion: 'casual',
      weather: WEATHER_MILD,
    });
    expect(input.count).toBe(SUGGESTION_COUNT);
    expect(input.seed).toBe(7);
  });

  it('omits weather and pins when there are none', () => {
    const { context } = buildGenerateInput(base);
    expect('weather' in context).toBe(false);
    expect('pinnedItemIds' in context).toBe(false);
  });

  it('drops pins that are no longer active', () => {
    const input = buildGenerateInput({
      ...base,
      pinnedItemIds: ['tee-navy', 'tee-black-laundry', 'missing'],
    });
    expect(input.context.pinnedItemIds).toEqual(['tee-navy']);
  });

  it('feeds the engine: pinned items appear in every result, same seed gives same result', () => {
    const args = { ...base, pinnedItemIds: ['skirt-midi-pleated'] };
    const a = generateOutfits(buildGenerateInput(args));
    const b = generateOutfits(buildGenerateInput(args));
    expect(a.suggestions.length).toBeGreaterThan(0);
    for (const s of a.suggestions) expect(s.itemIds).toContain('skirt-midi-pleated');
    expect(a).toEqual(b);
  });

  it('reports the missing slots for a tiny closet', () => {
    const tiny = base.items.filter((i) => i.id === 'tee-navy' || i.id === 'jeans-dark');
    const result = generateOutfits(buildGenerateInput({ ...base, items: tiny, occasion: 'any' }));
    expect(result.suggestions).toEqual([]);
    expect(result.diagnostics.missingSlots).toEqual(['shoes']);
  });
});

describe('time and seeds', () => {
  it('formats a local date', () => {
    expect(todayISO(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  });

  it('seeds are non-negative integers', () => {
    const s = newSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});
