import type { FitBody, GarmentRig, Point, RigKind } from '../model/types';
import { garmentMask, type GarmentMask, type GarmentName } from '../testing/garmentMasks';
import { syntheticPerson } from '../testing/poses';
import { BODY_A, BODY_A_ELBOWS } from '../tryon/bodies';
import { bodyCropWindow, elbowsToCanvas, fromBlazePose, toCanvas } from '../tryon/pose';
import { detectRig } from './detect';

/** Shared fixtures for the fit tests: garment kinds, detected rigs and bodies. */
export const KIND: Record<GarmentName, RigKind> = {
  tee: 'top',
  longSleeve: 'top',
  sleevelessTop: 'top',
  coat: 'top',
  jeans: 'trousers',
  wideLeg: 'trousers',
  shorts: 'trousers',
  aLineSkirt: 'skirt',
  pencilSkirt: 'skirt',
  sleevedDress: 'dress',
  sleevelessDress: 'dress',
  jumpsuit: 'jumpsuit',
};

export const NAMES = Object.keys(KIND) as GarmentName[];

export type FitSlot = 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece';

/** Slots a garment is worn in. */
export function slotsOf(name: GarmentName): FitSlot[] {
  const kind = KIND[name];
  if (kind === 'top') return ['base', 'mid', 'outer'];
  if (kind === 'trousers' || kind === 'skirt') return ['bottom'];
  return ['onepiece'];
}

export interface Detected {
  rig: GarmentRig;
  aspect: number;
  mask: GarmentMask;
}

/** A garment drawn, then detected (never undefined for the fixtures). */
export function detected(name: GarmentName, rotate = 0): Detected {
  const mask = garmentMask(name, { rotate });
  const rig = detectRig(mask.mask, KIND[name]);
  if (!rig) throw new Error(`no rig for ${name}`);
  return { rig, aspect: mask.aspect, mask };
}

export const bodyA: FitBody = { ...BODY_A.landmarks, ...BODY_A_ELBOWS };

/** A body from a synthetic photo, the way the app derives it (pose → crop → mannequin units). */
export function photoBody(options: Parameters<typeof syntheticPerson>[0] = {}): FitBody {
  const person = syntheticPerson(options);
  const result = fromBlazePose(person.keypoints, person.width, person.height);
  if (!result.landmarks || !result.elbows) throw new Error('no pose');
  const window = bodyCropWindow(result.landmarks);
  return { ...toCanvas(result.landmarks, window), ...elbowsToCanvas(result.elbows, window) };
}

/** A body scaled uniformly about the canvas origin. */
export function scaleBody(body: FitBody, factor: number): FitBody {
  const out: Record<string, Point> = {};
  for (const [k, v] of Object.entries(body) as [string, Point][]) {
    out[k] = { x: v.x * factor, y: v.y * factor };
  }
  return out as unknown as FitBody;
}
