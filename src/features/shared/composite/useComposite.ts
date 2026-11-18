import { useEffect, useMemo, useReducer, useRef } from 'react';
import { PixelRatio } from 'react-native';
import type { BodyTemplate, ID, Item, Outfit } from '@/core/model/types';
import { colors } from '@/ui/theme';
import type { FittedLayer } from '@/ui/mannequin';
import { bodySignature, fitDensity } from '../fit/fitKey';
import type { CompositeEngine, CompositeJob } from './compositeEngine';
import { getCompositeEngine } from './compositeServices';
import { compositeKey, mergeLayers, seedFor } from './layers';

/** Default mannequin width (CSS px) used to pick the image resolution. */
const DEFAULT_DISPLAY_WIDTH = 300;
/**
 * How long the inputs must stay the same before a merge starts. Warped garments arrive one after
 * the other; this waits for the last one instead of merging each intermediate state.
 */
const SETTLE_MS = 250;

export interface UseCompositeOptions {
  items: readonly Item[];
  body: BodyTemplate;
  /** The person's photo (photo mode); without it the silhouette is the backdrop. */
  backdrop?: string;
  outfit?: Outfit;
  /** Displayable cutout URIs by cutout image id (what the Mannequin gets as `imageUris`). */
  imageUris: Readonly<Record<ID, string | undefined>>;
  /** What `useFittedLayers` returned for the same items and body. */
  fitted?: Readonly<Record<ID, FittedLayer>>;
  /** Rendered mannequin width in CSS px; picks the image resolution (same as for fitting). */
  displayWidth?: number;
  /** Colour behind the silhouette: the surface the mannequin sits on. Default the page colour. */
  background?: string;
  /** Off while a garment is being edited, or where nothing is shown (no work is done, `uri` is empty). */
  enabled?: boolean;
  /** Replace the app-wide engine (tests). */
  engine?: CompositeEngine;
  /** Replace the settle time (tests). */
  settleMs?: number;
}

export interface UseComposite {
  /** The merged picture for exactly these inputs, once rendered. */
  uri?: string;
  /** Inputs are complete and a picture is on its way. */
  busy: boolean;
}

/**
 * The outfit merged into one picture (docs/TRY_ON.md §13): colour matched, shaded and shadowed
 * into the body photo or the silhouette. The caller keeps showing the layered Mannequin until
 * `uri` appears, so a changed outfit never shows a stale or half-finished merge. Cached by
 * backdrop, body, layers and density; a cached picture is returned on the first render.
 */
export function useComposite(options: UseCompositeOptions): UseComposite {
  const {
    items,
    body,
    backdrop,
    outfit,
    imageUris,
    fitted,
    displayWidth = DEFAULT_DISPLAY_WIDTH,
    background = colors.bg,
    enabled = true,
    settleMs = SETTLE_MS,
  } = options;
  const engine = options.engine ?? getCompositeEngine();
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const density = fitDensity(displayWidth, PixelRatio.get());
  const bodySig = useMemo(() => bodySignature(body.landmarks), [body]);

  const job: CompositeJob | undefined = useMemo(() => {
    if (!enabled || !engine.available || items.length === 0) return undefined;
    // Photo mode before the photo has loaded: its landmarks are in use, but there is nothing to merge into.
    if (body.id === 'photo' && !backdrop) return undefined;
    const layers = mergeLayers(items, body, outfit, imageUris, fitted);
    if (!layers || layers.length === 0) return undefined;
    const kind = backdrop ? 'photo' : 'silhouette';
    const key = compositeKey({
      backdrop: backdrop ? `photo:${backdrop}` : `silhouette:${body.id}:${background}`,
      bodySig,
      layers,
      density,
    });
    return {
      key,
      request: {
        backdropUri: backdrop ?? '',
        kind,
        layers: layers.map(({ uri, x, y, width, height, rotation }) => ({
          uri,
          x,
          y,
          width,
          height,
          rotation,
        })),
        pixelsPerUnit: density,
        seed: seedFor(key),
        ...(kind === 'silhouette' ? { palette: { background, figure: colors.silhouette } } : {}),
      },
    };
  }, [
    enabled,
    engine,
    items,
    body,
    backdrop,
    outfit,
    imageUris,
    fitted,
    bodySig,
    density,
    background,
  ]);
  const key = job?.key;

  // Merged pictures live in a cache outside React (the React Compiler cannot see it change), so
  // `tick` (bumped when a render finishes) is an explicit dependency.
  const uri = useMemo(() => readPicture(engine, key, tick), [engine, key, tick]);

  // Keep the picture that is on screen alive even if the cache evicts it.
  useEffect(() => (key ? engine.pin(key) : undefined), [engine, key]);

  const latest = useRef(job);
  useEffect(() => {
    latest.current = job;
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const current = latest.current;
    if (!current || engine.peek(current.key) || engine.failed(current.key)) return;
    const timer = setTimeout(() => {
      void engine.request(current).then(() => {
        if (mounted.current) bump();
      });
    }, settleMs);
    return () => clearTimeout(timer);
  }, [engine, key, settleMs]);

  const busy = key !== undefined && uri === undefined && !engine.failed(key);
  return { ...(uri ? { uri } : {}), busy };
}

/** The finished picture for `key` (the cache is mutable state outside React; `version` re-reads it). */
function readPicture(engine: CompositeEngine, key: string | undefined, version: number) {
  void version;
  return key ? engine.peek(key) : undefined;
}
