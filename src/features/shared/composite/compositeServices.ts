import { getServices } from '@/services';
import { createCompositeEngine, type CompositeEngine } from './compositeEngine';

let engine: CompositeEngine | undefined;

/** App-wide merged-picture cache over the real compositor (created on first use). */
export function getCompositeEngine(): CompositeEngine {
  engine ??= createCompositeEngine(getServices().compositor);
  return engine;
}
