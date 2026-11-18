import type { GenerateResult } from '@/core/engine/generate';
import type { OutfitSuggestion } from '@/core/model/types';
import { suggestionView } from './suggestionView';

const suggestion: OutfitSuggestion = {
  itemIds: ['a'],
  score: 90,
  breakdown: { total: 90, components: {}, reasons: [] },
  reasons: [],
};
const result = (over: Partial<GenerateResult>): GenerateResult => ({
  suggestions: [],
  diagnostics: { consideredCombos: 0, sampled: false },
  ...over,
});

describe('suggestionView', () => {
  it('is empty with no active items, whatever the engine said', () => {
    expect(suggestionView(result({ suggestions: [suggestion] }), 0)).toEqual({ kind: 'empty' });
  });

  it('is ready with suggestions', () => {
    expect(suggestionView(result({ suggestions: [suggestion] }), 3)).toEqual({
      kind: 'ready',
      suggestions: [suggestion],
    });
  });

  it('is too-small with the missing slots', () => {
    const r = result({
      diagnostics: { consideredCombos: 0, sampled: false, missingSlots: ['shoes'] },
    });
    expect(suggestionView(r, 2)).toEqual({ kind: 'too-small', slots: ['shoes'] });
  });

  it('is none when nothing came out and nothing is missing (e.g. conflicting pins)', () => {
    expect(suggestionView(result({}), 5)).toEqual({ kind: 'none' });
  });
});
