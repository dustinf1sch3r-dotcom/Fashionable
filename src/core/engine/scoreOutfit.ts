import { colourHarmony } from '../color/harmony';
import type {
  Feedback,
  ISODate,
  Item,
  Occasion,
  Reason,
  ScoreBreakdown,
  ScoreComponent,
  Weather,
  WearLog,
} from '../model/types';
import { COMPONENT_WEIGHTS } from './weights';
import { scoreCoordination } from './score/coordination';
import { scoreFormality } from './score/formality';
import { scoreFreshness } from './score/freshness';
import { scoreOccasion } from './score/occasion';
import { scorePattern } from './score/pattern';
import { clamp01 } from './score/types';
import type { ComponentResult } from './score/types';
import { scoreWeather, sunBonusPoints } from './score/weather';

export interface ScoreContext {
  date: ISODate;
  occasion: Occasion;
  /** Omitted → weather component skipped. */
  weather?: Weather;
}

export interface ScoreHistory {
  wearLogs: readonly WearLog[];
  feedback?: readonly Feedback[];
}

/**
 * Taste hook (OUTFIT_ENGINE §7). Always `null` (skipped) until M1-6 provides the affinity model.
 * TODO(M1-6): replace with the real taste score from `engine/taste.ts`.
 */
function scoreTaste(
  _items: readonly Item[],
  _feedback: readonly Feedback[],
): ComponentResult | null {
  return null;
}

/**
 * Combine the component scores (OUTFIT_ENGINE §4): 100 × weighted mean, with the weights of
 * non-applicable (`null`) components dropped and the rest renormalised. The sunny-weather bonus
 * (§6) is then added in points, and the total clamped to 0–100.
 */
export function scoreOutfit(
  items: readonly Item[],
  context: ScoreContext,
  history: ScoreHistory,
): ScoreBreakdown {
  const list = [...items];
  const results: [ScoreComponent, ComponentResult | null][] = [];
  if (list.length > 0) {
    const colour = colourHarmony(list);
    results.push(['colour', { value: colour.value, reasons: [colour.reason] }]);
  }
  results.push(
    ['formality', scoreFormality(list)],
    ['weather', scoreWeather(list, context.weather)],
    ['pattern', list.length > 0 ? scorePattern(list, context.occasion) : null],
    ['occasion', scoreOccasion(list, context.occasion)],
    ['coordination', scoreCoordination(list)],
    ['freshness', scoreFreshness(list, context.date, history.wearLogs)],
    ['taste', scoreTaste(list, history.feedback ?? [])],
  );

  const applied = results.filter((r): r is [ScoreComponent, ComponentResult] => r[1] !== null);
  const totalWeight = applied.reduce((s, [c]) => s + COMPONENT_WEIGHTS[c], 0);

  const components: ScoreBreakdown['components'] = {};
  const reasons: Reason[] = [];
  let weighted = 0;
  for (const [c, r] of applied) {
    const weight = COMPONENT_WEIGHTS[c] / totalWeight;
    components[c] = { value: r.value, weight };
    weighted += weight * r.value;
    reasons.push(...r.reasons);
  }

  const bonus = sunBonusPoints(list, context.weather);
  const total = applied.length === 0 ? 0 : 100 * clamp01((100 * weighted + bonus) / 100);
  return { total, components, reasons };
}
