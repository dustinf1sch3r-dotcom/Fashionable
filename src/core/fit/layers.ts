import type { FitBody, GarmentRig, ID, Point } from '../model/types';
import { nestInside } from './nest';
import { rigTargets } from './targets';

export type LayerSlot = 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece';

export interface LayerInput {
  itemId: ID;
  rig: GarmentRig;
  /** Cutout width ÷ height. */
  aspect: number;
  slot: LayerSlot;
}

export interface LayerTargets {
  targets: Record<string, Point>;
  /** Ids of the garments these targets were nested inside, outermost first (part of cache keys). */
  nestedIn: ID[];
}

/**
 * Body targets for every fitted garment of one outfit (docs/TRY_ON.md §12.3 "Layering"): each
 * top is fitted on its own, then nested inside the layer worn over it — outer first, the mid layer
 * inside the outer, the base top inside the mid layer (or the outer when there is no mid layer).
 * Bottoms, one-pieces and non-`top` rigs are not nested.
 */
export function layeredTargets(
  inputs: readonly LayerInput[],
  body: FitBody,
): Record<ID, LayerTargets> {
  const out: Record<ID, LayerTargets> = {};
  for (const l of inputs) {
    out[l.itemId] = { targets: rigTargets(l.rig, l.aspect, body, l.slot), nestedIn: [] };
  }
  const top = (slot: LayerSlot) => inputs.find((l) => l.slot === slot && l.rig.kind === 'top');
  const outer = top('outer');
  const mid = top('mid');
  const base = top('base');
  if (mid && outer) {
    const nested = nestInside(out[mid.itemId].targets, out[outer.itemId].targets, body);
    out[mid.itemId] = { targets: nested, nestedIn: [outer.itemId] };
  }
  const over = mid ?? outer;
  if (base && over) {
    const nested = nestInside(out[base.itemId].targets, out[over.itemId].targets, body);
    out[base.itemId] = { targets: nested, nestedIn: [...out[over.itemId].nestedIn, over.itemId] };
  }
  return out;
}
