import { getServices } from '@/services';
import { getStores } from '@/state';
import { createFitEngine, type FitEngine } from './fitEngine';
import { createLazyRigDetector, type LazyRigDetector } from './rigLifecycle';

let engine: FitEngine | undefined;
let detector: LazyRigDetector | undefined;

/** App-wide fitted-image cache over the real renderer (created on first use). */
export function getFitEngine(): FitEngine {
  engine ??= createFitEngine(getServices().warper);
  return engine;
}

/** App-wide lazy rig detection, saving into the real closet store. */
export function getLazyRigDetector(): LazyRigDetector {
  detector ??= createLazyRigDetector({
    pixels: getServices().pixels,
    save: (id, rig) => getStores().closet.getState().updateItem(id, { fit: rig }),
  });
  return detector;
}
