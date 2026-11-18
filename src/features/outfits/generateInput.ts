import type { GenerateInput } from '@/core/engine/generate';
import type { Feedback, ID, ISODate, Item, Occasion, Weather, WearLog } from '@/core/model/types';
import { localISODate } from '@/core/weather';

export const SUGGESTION_COUNT = 5;

/** Today's local calendar date. Time lives in the feature layer, never in core. */
export const todayISO = (now: Date = new Date()): ISODate => localISODate(now);

/** A fresh seed for "Surprise me" (randomness is allowed here, not in core). */
export const newSeed = (): number => Math.floor(Math.random() * 0x7fffffff);

export interface GenerateArgs {
  items: readonly Item[];
  wearLogs: readonly WearLog[];
  feedback: readonly Feedback[];
  weather?: Weather;
  occasion: Occasion;
  date: ISODate;
  pinnedItemIds: readonly ID[];
  seed: number;
}

/** Builds the engine input: only active items, pins that still exist, weather when known. */
export function buildGenerateInput(args: GenerateArgs): GenerateInput {
  const active = args.items.filter((i) => i.status === 'active');
  const activeIds = new Set(active.map((i) => i.id));
  const pinned = args.pinnedItemIds.filter((id) => activeIds.has(id));
  return {
    items: active,
    wearLogs: args.wearLogs,
    feedback: args.feedback,
    context: {
      date: args.date,
      occasion: args.occasion,
      ...(args.weather ? { weather: args.weather } : {}),
      ...(pinned.length > 0 ? { pinnedItemIds: pinned } : {}),
    },
    count: SUGGESTION_COUNT,
    seed: args.seed,
  };
}
