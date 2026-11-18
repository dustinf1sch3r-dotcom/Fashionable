import type { GenerateResult } from '@/core/engine/generate';
import type { OutfitSuggestion, Slot } from '@/core/model/types';

/** What the Ideas tab should show for a generate result. */
export type SuggestionView =
  | { kind: 'empty' }
  | { kind: 'too-small'; slots: Slot[] }
  | { kind: 'none' }
  | { kind: 'ready'; suggestions: OutfitSuggestion[] };

export function suggestionView(result: GenerateResult, activeCount: number): SuggestionView {
  if (activeCount === 0) return { kind: 'empty' };
  const { suggestions, diagnostics } = result;
  if (suggestions.length > 0) return { kind: 'ready', suggestions };
  if (diagnostics.missingSlots && diagnostics.missingSlots.length > 0) {
    return { kind: 'too-small', slots: diagnostics.missingSlots };
  }
  return { kind: 'none' };
}
