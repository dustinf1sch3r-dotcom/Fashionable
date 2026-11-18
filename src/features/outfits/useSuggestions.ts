import { useEffect, useState } from 'react';
import { generateOutfits, type GenerateResult } from '@/core/engine/generate';
import type { ID, Occasion } from '@/core/model/types';
import { getStores, useCloset, useOutfits, useWear, useWeather } from '@/state';
import { buildGenerateInput, todayISO } from './generateInput';
import { styleSignature } from './styleSignature';

interface Params {
  occasion: Occasion;
  pinnedItemIds: readonly ID[];
  seed: number;
}

interface Suggestions {
  /** Undefined until the first run has finished. */
  result: GenerateResult | undefined;
  /** True while a run is queued or in flight. */
  busy: boolean;
  /** Active items the run was based on. */
  activeCount: number;
}

interface Done {
  result: GenerateResult;
  activeCount: number;
  /** The inputs the result was computed from; a mismatch with the live ones means "busy". */
  styleKey: string;
  weather: unknown;
  occasion: Occasion;
  pinKey: string;
  seed: number;
}

/**
 * Runs the outfit engine off the render path (a macrotask after the commit) whenever its real
 * inputs change: closet, today's weather, occasion, pins or seed. Likes and wear history are read
 * at run time and deliberately not dependencies, so rating a card never reshuffles the list.
 */
export function useSuggestions({ occasion, pinnedItemIds, seed }: Params): Suggestions {
  // Regenerate only when something the engine reads changes. Saving garment points, fit tweaks or
  // photos (which happens shortly after the screen opens) keeps this key, so cards never reshuffle;
  // the items themselves are read from the store when the engine runs.
  const styleKey = useCloset((s) => styleSignature(s.items));
  const closetStatus = useCloset((s) => s.status);
  const outfitStatus = useOutfits((s) => s.status);
  const wearStatus = useWear((s) => s.status);
  const weather = useWeather((s) => s.today);
  const [done, setDone] = useState<Done | undefined>();

  const settled = (s: string) => s === 'ready' || s === 'error';
  const ready = settled(closetStatus) && settled(outfitStatus) && settled(wearStatus);
  const pinKey = pinnedItemIds.join('|');

  useEffect(() => {
    if (!ready) return;
    const handle = setTimeout(() => {
      const stores = getStores();
      const items = stores.closet.getState().items;
      const input = buildGenerateInput({
        items,
        wearLogs: stores.wear.getState().logs,
        feedback: stores.outfits.getState().feedback,
        weather,
        occasion,
        date: todayISO(),
        pinnedItemIds: pinKey ? pinKey.split('|') : [],
        seed,
      });
      setDone({
        result: generateOutfits(input),
        activeCount: input.items.length,
        styleKey,
        weather,
        occasion,
        pinKey,
        seed,
      });
    }, 0);
    return () => clearTimeout(handle);
  }, [ready, styleKey, weather, occasion, pinKey, seed]);

  const current =
    done !== undefined &&
    done.styleKey === styleKey &&
    done.weather === weather &&
    done.occasion === occasion &&
    done.pinKey === pinKey &&
    done.seed === seed;
  return { result: done?.result, busy: !ready || !current, activeCount: done?.activeCount ?? 0 };
}
