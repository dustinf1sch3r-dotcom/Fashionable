import { useEffect, useMemo, useState } from 'react';
import type { Item } from '@/core/model/types';
import { closetSignature, computeInsights, type Insights } from './insights';

/** Last result, kept across screen visits so reopening Insights is instant. */
let cached: { signature: string; insights: Insights } | undefined;

/** Test helper. */
export function clearInsightsCache(): void {
  cached = undefined;
}

/**
 * Gap analysis of the closet. The first result can take ~100–200 ms on a big closet, so it runs
 * after the first paint (the screen shows a skeleton meanwhile) and is memoised on closet content.
 * Returns undefined while computing, or when `enabled` is false.
 */
export function useInsights(items: readonly Item[], enabled: boolean): Insights | undefined {
  const signature = useMemo(() => closetSignature(items), [items]);
  const [, bump] = useState(0);

  useEffect(() => {
    if (!enabled || cached?.signature === signature) return;
    let live = true;
    const timer = setTimeout(() => {
      cached = { signature, insights: computeInsights(items) };
      if (live) bump((n) => n + 1);
    }, 30);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [enabled, signature, items]);

  return enabled && cached?.signature === signature ? cached.insights : undefined;
}
