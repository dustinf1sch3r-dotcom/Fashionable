import { renderHook, waitFor } from '@testing-library/react-native';
import type { FitMesh } from '@/core/fit';
import type { GarmentRig, Item } from '@/core/model/types';
import { fixtureById } from '@/core/testing/fixtures';
import { BODY_A } from '@/core/tryon/bodies';
import { resetStores } from '@/state';
import { createFitEngine, type FitEngine } from './fitEngine';
import type { LazyRigDetector } from './rigLifecycle';
import { rigFor, useFittedLayers } from './useFittedLayers';

jest.mock('@/core/fit', () => ({
  RIG_VERSION: 1,
  // Layering is tested in core (src/core/fit/layers.test.ts); here every garment is unnested.
  layeredTargets: (inputs: { itemId: string }[]) =>
    Object.fromEntries(inputs.map((l) => [l.itemId, { targets: {}, nestedIn: [] }])),
  rigKindOf: (i: { category: string }) =>
    i.category === 'top' ? 'top' : i.category === 'bottom' ? 'trousers' : undefined,
  rigTargets: jest.fn(() => ({})),
  buildFitMesh: jest.fn(() => ({
    source: [],
    target: [],
    triangles: [],
    bounds: { x: 10, y: 20, width: 300, height: 400 },
  })),
}));

const rig = (over: Partial<GarmentRig> = {}): GarmentRig => ({
  kind: 'top',
  version: 1,
  points: { neckL: { x: 0.4, y: 0.1 } },
  confidence: 0.9,
  edited: false,
  ...over,
});
const withRig = (item: Item, r: GarmentRig): Item => ({ ...item, fit: r });
const tee = withRig(fixtureById('tee-white'), rig());
const jeans = withRig(fixtureById('jeans-dark'), rig({ kind: 'trousers' }));
const shoes = fixtureById('sneakers-white');
const uris = {
  [tee.images.cutoutId]: 'blob:tee',
  [jeans.images.cutoutId]: 'blob:jeans',
  [shoes.images.cutoutId]: 'blob:shoes',
};

function setup(available = true) {
  const gate: { wait?: Promise<void> } = {};
  let calls = 0;
  const render = jest.fn(async (_uri: string, mesh: FitMesh) => {
    calls += 1;
    const n = calls;
    if (n === 2 && gate.wait) await gate.wait;
    return { uri: `blob:fitted-${n}`, bounds: mesh.bounds };
  });
  const engine: FitEngine = createFitEngine({ available, render });
  const detector: LazyRigDetector = {
    peek: () => undefined,
    ensure: jest.fn(async () => undefined),
    flush: jest.fn(),
  };
  return { engine, detector, render, gate };
}

beforeEach(() => resetStores());

describe('useFittedLayers', () => {
  it('fits tops and bottoms that have a rig and leaves shoes rigid', async () => {
    const { engine, detector } = setup();
    const { result } = await renderHook(() =>
      useFittedLayers([tee, jeans, shoes], BODY_A, { imageUris: uris, engine, detector }),
    );
    await waitFor(() =>
      expect(Object.keys(result.current).sort()).toEqual(['jeans-dark', 'tee-white']),
    );
    expect(result.current['tee-white']?.bounds).toEqual({ x: 10, y: 20, width: 300, height: 400 });
    expect(result.current['sneakers-white']).toBeUndefined();
  });

  it('draws nothing fitted when the renderer is unavailable or fitting is off', async () => {
    const off = setup(false);
    const a = await renderHook(() =>
      useFittedLayers([tee], BODY_A, {
        imageUris: uris,
        engine: off.engine,
        detector: off.detector,
      }),
    );
    expect(a.result.current).toEqual({});
    expect(off.render).not.toHaveBeenCalled();
    const on = setup();
    const b = await renderHook(() =>
      useFittedLayers([tee], BODY_A, {
        imageUris: uris,
        engine: on.engine,
        detector: on.detector,
        enabled: false,
      }),
    );
    expect(b.result.current).toEqual({});
    expect(on.render).not.toHaveBeenCalled();
  });

  it('waits for the cutout picture before rendering', async () => {
    const { engine, detector, render } = setup();
    const { result, rerender } = await renderHook(
      (props: { imageUris: Record<string, string> }) =>
        useFittedLayers([tee], BODY_A, { imageUris: props.imageUris, engine, detector }),
      { initialProps: { imageUris: {} } },
    );
    expect(render).not.toHaveBeenCalled();
    await rerender({ imageUris: uris });
    await waitFor(() => expect(result.current['tee-white']).toBeDefined());
  });

  it('keeps the previous fitted image while a new body is rendering, then swaps', async () => {
    const { engine, detector, render, gate } = setup();
    let open: () => void = () => undefined;
    gate.wait = new Promise<void>((r) => (open = r));
    const photoBody = {
      id: 'photo',
      landmarks: { ...BODY_A.landmarks, shoulderL: { x: 300, y: 410 } },
    };
    const { result, rerender } = await renderHook(
      (props: { body: typeof BODY_A }) =>
        useFittedLayers([tee], props.body, { imageUris: uris, engine, detector }),
      { initialProps: { body: BODY_A } },
    );
    await waitFor(() => expect(result.current['tee-white']?.uri).toBe('blob:fitted-1'));
    await rerender({ body: photoBody });
    // Immediately after the change the old image is still there (no fall back to rigid)…
    expect(result.current['tee-white']?.uri).toBe('blob:fitted-1');
    // …and the new one replaces it once rendered.
    open();
    await waitFor(() => expect(result.current['tee-white']?.uri).toBe('blob:fitted-2'));
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('asks the detector for a rig when an item has none, and fits once it is found', async () => {
    const { engine, detector } = setup();
    const found = rig();
    let ready = false;
    detector.peek = () => (ready ? found : undefined);
    (detector.ensure as jest.Mock).mockImplementation(async () => {
      ready = true;
      return found;
    });
    const bare = fixtureById('tee-white');
    const { result } = await renderHook(() =>
      useFittedLayers([bare], BODY_A, { imageUris: uris, engine, detector }),
    );
    await waitFor(() => expect(result.current['tee-white']).toBeDefined());
    expect(detector.ensure).toHaveBeenCalledTimes(1);
  });

  it('never tries to fit an item that is only a photo', async () => {
    const { engine, detector, render } = setup();
    const photo: Item = { ...tee, cutout: { ...tee.cutout, hasAlpha: false } };
    const { result } = await renderHook(() =>
      useFittedLayers([photo], BODY_A, { imageUris: uris, engine, detector }),
    );
    expect(result.current).toEqual({});
    expect(render).not.toHaveBeenCalled();
    expect(detector.ensure).not.toHaveBeenCalled();
  });
});

describe('rigFor', () => {
  const detector = (found?: GarmentRig): LazyRigDetector => ({
    peek: () => found,
    ensure: async () => found,
    flush: () => undefined,
  });
  it('prefers a usable stored rig, else the one detected this session', () => {
    const detected = rig({ confidence: 0.5 });
    expect(rigFor(tee, detector(detected))).toBe(tee.fit);
    const stale = withRig(tee, rig({ kind: 'trousers' }));
    expect(rigFor(stale, detector(detected))).toBe(detected);
    expect(rigFor(fixtureById('tee-white'), detector())).toBeUndefined();
  });
});
