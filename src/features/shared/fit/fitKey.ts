import type { FitBody, GarmentRig, Item, Point } from '@/core/model/types';
import { slotOf } from '@/core/model/slots';

/** Slots whose garments are fitted to the body (docs/TRY_ON.md §12). */
export type FitSlot = 'base' | 'mid' | 'outer' | 'bottom' | 'onepiece';

/** The fitting slot of an item, or `undefined` when it keeps rigid placement (shoes, bags, …). */
export function fitSlotOf(
  item: Pick<Item, 'category' | 'subcategory' | 'layer'>,
): FitSlot | undefined {
  const slot = slotOf(item);
  return slot === 'base' ||
    slot === 'mid' ||
    slot === 'outer' ||
    slot === 'bottom' ||
    slot === 'onepiece'
    ? slot
    : undefined;
}

/** FNV-1a over a string, as 8 hex digits. Stable across runs; not for security. */
export function hashString(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const q = (v: number, step: number): number => Math.round(v / step);

function pointsText(points: Readonly<Record<string, Point | undefined>>, step: number): string {
  return Object.keys(points)
    .sort()
    .map((k) => {
      const p = points[k];
      return p ? `${k}:${q(p.x, step)},${q(p.y, step)}` : '';
    })
    .join(';');
}

/** Identifies a rig's content: kind, rule-set version, edited flag and its points (to 0.0005). */
export function rigSignature(rig: GarmentRig): string {
  return `${rig.kind}.v${rig.version}.${rig.edited ? 'e' : 'a'}.${hashString(pointsText(rig.points, 0.0005))}`;
}

/** Identifies a body: every landmark and elbow to a mannequin unit. */
export function bodySignature(body: FitBody): string {
  const { elbowL, elbowR, ...landmarks } = body;
  const extra = { ...(elbowL ? { elbowL } : {}), ...(elbowR ? { elbowR } : {}) };
  return hashString(pointsText({ ...landmarks, ...extra }, 1));
}

/** Output pixels per mannequin unit, quantised so near-equal sizes share cache entries. */
export function fitDensity(displayWidthCssPx: number, devicePixelRatio: number): number {
  const raw = (Math.max(0, displayWidthCssPx) / 1000) * Math.max(1, devicePixelRatio);
  if (raw <= 0.5) return 0.5;
  if (raw <= 0.75) return 0.75;
  return 1;
}

export interface FitKeyParts {
  /** What the targets depend on beyond this garment, e.g. the layers it is nested inside. */
  context?: string;
  itemId: string;
  cutoutId: string;
  rig: GarmentRig;
  bodySig: string;
  slot: FitSlot;
  density: number;
}

/** Cache key of one fitted image: item, cutout, rig (version / edits), body, slot and density. */
export function fitKey(p: FitKeyParts): string {
  const parts = [p.itemId, p.cutoutId, rigSignature(p.rig), p.bodySig, p.slot, p.density];
  // Garments nested inside others (layering) depend on those layers too.
  if (p.context) parts.push(p.context);
  return parts.join('|');
}
