import type { Occasion, Slot } from '@/core/model/types';

const SLOT_PHRASE: Partial<Record<Slot, string>> = {
  base: 'a top',
  bottom: 'trousers or a skirt',
  shoes: 'some shoes',
  onepiece: 'a dress',
};

const SLOT_ORDER: readonly Slot[] = ['base', 'bottom', 'onepiece', 'shoes'];

/** "some shoes and a top" — what to add, in a natural order. */
export function missingSlotsPhrase(slots: readonly Slot[]): string {
  const phrases = SLOT_ORDER.filter((s) => slots.includes(s)).map((s) => SLOT_PHRASE[s] as string);
  if (phrases.length === 0) return 'a few more pieces';
  if (phrases.length === 1) return phrases[0] as string;
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1] as string}`;
}

export const OCCASION_LABELS: Record<Occasion, string> = {
  any: 'Any',
  casual: 'Casual',
  work: 'Work',
  smart: 'Smart',
  formal: 'Formal',
  active: 'Active',
  lounge: 'Lounge',
};

export const OCCASION_ORDER: readonly Occasion[] = [
  'any',
  'casual',
  'work',
  'smart',
  'formal',
  'active',
  'lounge',
];

export interface TooSmallText {
  title: string;
  body: string;
}

/** Copy for the "closet too small" state; names the slots and, for a filtered occasion, says so. */
export function tooSmallText(slots: readonly Slot[], occasion: Occasion): TooSmallText {
  const need = missingSlotsPhrase(slots);
  if (occasion === 'any') {
    return {
      title: 'Add a few more pieces',
      body: `Add ${need} to get outfit ideas.`,
    };
  }
  return {
    title: `Not enough for ${OCCASION_LABELS[occasion].toLowerCase()} yet`,
    body: `Add ${need} that suit ${OCCASION_LABELS[occasion].toLowerCase()}, or try another occasion.`,
  };
}
