import { useEffect, useMemo, useReducer, useRef } from 'react';
import { layeredTargets, type LayerInput } from '@/core/fit';
import type { BodyTemplate, FitBody, GarmentRig, ID, Item } from '@/core/model/types';
import { BODY_A_ELBOWS } from '@/core/tryon/bodies';
import { useProfile } from '@/state';
import type { FittedLayer } from '@/ui/mannequin';
import { PixelRatio } from 'react-native';
import type { FitEngine, FitJob } from './fitEngine';
import { getFitEngine, getLazyRigDetector } from './fitServices';
import { bodySignature, fitDensity, fitKey, fitSlotOf, rigSignature } from './fitKey';
import { fitUsable, isFittable, rigIsCurrent, type LazyRigDetector } from './rigLifecycle';

/** Default mannequin width (CSS px) used to pick the image resolution. */
const DEFAULT_DISPLAY_WIDTH = 300;

export interface UseFittedLayersOptions {
  /** Displayable cutout URIs by cutout image id (what the Mannequin gets as `imageUris`). */
  imageUris: Readonly<Record<ID, string | undefined>>;
  /** Rendered mannequin width in CSS px; picks the image resolution. */
  displayWidth?: number;
  /** Turn fitting off (the Mannequin then keeps rigid placement). Default true. */
  enabled?: boolean;
  /** Replace the app-wide engine / detector (tests). */
  engine?: FitEngine;
  detector?: LazyRigDetector;
}

/** The rig to draw an item with: its stored one if usable, else one detected this session. */
export function rigFor(item: Item, detector: LazyRigDetector): GarmentRig | undefined {
  if (rigIsCurrent(item, item.fit)) return item.fit;
  return detector.peek(item);
}

/**
 * Fitted garment images for a mannequin (docs/TRY_ON.md §12.5): for each fittable item with a rig,
 * the cutout warped to `body`, keyed by item id. Items that are not fittable, have no rig yet, or
 * are still being rendered are left out, so the Mannequin draws them rigidly (so are items whose
 * detected rig is below `FIT_MIN_CONFIDENCE` and was never edited); an item already
 * fitted for another body keeps that image until the new one is ready. Items that have no rig get
 * one detected lazily and saved back to the closet.
 */
export function useFittedLayers(
  items: readonly Item[],
  body: BodyTemplate,
  options: UseFittedLayersOptions,
): Readonly<Record<ID, FittedLayer>> {
  const { imageUris, displayWidth = DEFAULT_DISPLAY_WIDTH, enabled = true } = options;
  const engine = options.engine ?? getFitEngine();
  const detector = options.detector ?? getLazyRigDetector();
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const elbows = useProfile((s) => s.profile?.bodyPhoto?.elbows);

  const active = enabled && engine.available;
  const fitBody: FitBody = useMemo(
    () =>
      body.id === 'photo'
        ? elbows
          ? { ...body.landmarks, ...elbows }
          : body.landmarks
        : body.id === 'body-a'
          ? { ...body.landmarks, ...BODY_A_ELBOWS }
          : body.landmarks,
    [body, elbows],
  );
  const bodySig = useMemo(() => bodySignature(fitBody), [fitBody]);
  const density = fitDensity(displayWidth, PixelRatio.get());

  // Rigs found by the lazy detector live outside React, so `tick` (bumped when one is found or an
  // image finishes) is passed in explicitly: the React Compiler only re-reads what it can see.
  const rigs = useMemo(() => resolveRigs(items, detector, tick), [items, detector, tick]);
  const jobs = useMemo(() => {
    if (!active) return [];
    // Work out every fitted garment's targets together so inner layers nest inside outer ones.
    const inputs: LayerInput[] = [];
    items.forEach((item, i) => {
      const slot = fitSlotOf(item);
      const rig = rigs[i];
      if (slot && rig && fitUsable(rig) && isFittable(item)) {
        inputs.push({ itemId: item.id, rig, aspect: item.cutout.aspectRatio, slot });
      }
    });
    const layered = layeredTargets(inputs, fitBody);
    const rigById = new Map(inputs.map((l) => [l.itemId, l.rig] as const));
    const out: { item: Item; job: FitJob | undefined }[] = [];
    items.forEach((item, i) => {
      const slot = fitSlotOf(item);
      const cutoutUri = imageUris[item.images.cutoutId];
      if (!slot || !cutoutUri || !isFittable(item)) return;
      const rig = rigs[i];
      if (!rig) {
        out.push({ item, job: undefined });
        return;
      }
      // A rig the detector was unsure about would warp the garment into something else: keep it
      // rigid (the item offers "Check garment points").
      if (!fitUsable(rig)) return;
      const layer = layered[item.id];
      const context = layer?.nestedIn.length
        ? `in:${layer.nestedIn
            .map((id) => {
              const r = rigById.get(id);
              return r ? `${id}~${rigSignature(r)}` : id;
            })
            .join(',')}`
        : undefined;
      const job: FitJob = {
        key: fitKey({
          itemId: item.id,
          cutoutId: item.images.cutoutId,
          rig,
          bodySig,
          slot,
          density,
          ...(context ? { context } : {}),
        }),
        itemId: item.id,
        cutoutId: item.images.cutoutId,
        cutoutUri,
        rig,
        aspect: item.cutout.aspectRatio,
        body: fitBody,
        slot,
        density,
        ...(layer ? { targets: layer.targets } : {}),
      };
      out.push({ item, job });
    });
    return out;
  }, [active, items, rigs, imageUris, bodySig, density, fitBody]);

  // Results arrive after the effect that asked for them may have re-run (callers often pass a
  // fresh `items` array every render), so "still mounted" is tracked separately.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (mounted.current) bump();
    };
    for (const { item, job } of jobs) {
      const uri = imageUris[item.images.cutoutId];
      if (!job) {
        if (uri) void detector.ensure(item, uri).then(refresh);
      } else if (!engine.peek(job.key)) {
        void engine.request(job).then(refresh);
      }
    }
  }, [jobs, engine, detector, imageUris]);

  // Finished images arrive through `bump`. The cache is plain mutable state outside React (the
  // React Compiler cannot see it change), so `tick` is an explicit dependency.
  return useMemo(() => readLayers(jobs, engine, tick), [jobs, engine, tick]);
}

/** The rig to draw each item with (see `rigFor`), in the order of `items`. */
function resolveRigs(
  items: readonly Item[],
  detector: LazyRigDetector,
  version: number,
): (GarmentRig | undefined)[] {
  void version;
  return items.map((item) => rigFor(item, detector));
}

/** The images to draw now: the exact one if rendered, else the item's newest one for another body. */
function readLayers(
  jobs: readonly { item: Item; job: FitJob | undefined }[],
  engine: FitEngine,
  version: number,
): Record<ID, FittedLayer> {
  void version;
  const out: Record<ID, FittedLayer> = {};
  for (const { item, job } of jobs) {
    if (!job) continue;
    const layer = engine.peek(job.key) ?? engine.latest(item.id, item.images.cutoutId);
    if (layer) out[item.id] = layer;
  }
  return out;
}
