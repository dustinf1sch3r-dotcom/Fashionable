import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Item } from '@/core/model/types';
import { fixtureById } from '@/core/testing/fixtures';
import { BODY_A } from '@/core/tryon/bodies';
import { createFakeOutfitCompositor } from '@/services/testing';
import { createCompositeEngine } from './compositeEngine';
import { useComposite } from './useComposite';

const tee = fixtureById('tee-white');
const jeans = fixtureById('jeans-dark');
const items = [tee, jeans];
const uris = Object.fromEntries(items.map((i) => [i.images.cutoutId, `blob:${i.id}`]));

function setup() {
  const compositor = createFakeOutfitCompositor();
  const engine = createCompositeEngine(compositor);
  return { compositor, engine };
}

type Props = {
  items?: readonly Item[];
  backdrop?: string;
  enabled?: boolean;
  imageUris?: Record<string, string | undefined>;
};

describe('useComposite', () => {
  it('merges once the inputs are complete and returns the picture', async () => {
    const { compositor, engine } = setup();
    const { result } = await renderHook(() =>
      useComposite({ items, body: BODY_A, imageUris: uris, engine, settleMs: 0 }),
    );
    expect(result.current.uri).toBeUndefined();
    expect(result.current.busy).toBe(true);
    await waitFor(() => expect(result.current.uri).toMatch(/^fake-composite:\/\/silhouette\/2\//));
    expect(result.current.busy).toBe(false);
    expect(compositor.calls).toBe(1);
    const input = compositor.inputs[0];
    expect(input?.layers.map((l) => l.uri).sort()).toEqual(['blob:jeans-dark', 'blob:tee-white']);
    expect(input?.pixelsPerUnit).toBeGreaterThan(0);
  });

  it('uses the body photo as the backdrop in photo mode, and waits for it to load', async () => {
    const { compositor, engine } = setup();
    const photoBody = { id: 'photo', landmarks: BODY_A.landmarks };
    const { result, rerender } = await renderHook(
      (p: Props) =>
        useComposite({
          items,
          body: photoBody,
          imageUris: uris,
          ...(p.backdrop ? { backdrop: p.backdrop } : {}),
          engine,
          settleMs: 0,
        }),
      { initialProps: {} as Props },
    );
    // Photo mode, photo still loading: nothing to merge into.
    expect(result.current.busy).toBe(false);
    expect(compositor.calls).toBe(0);
    await rerender({ backdrop: 'blob:me' });
    await waitFor(() => expect(result.current.uri).toMatch(/^fake-composite:\/\/photo\//));
    expect(compositor.inputs[0]?.backdropUri).toBe('blob:me');
  });

  it('waits for every cutout picture and does not merge when disabled', async () => {
    const { compositor, engine } = setup();
    const { result, rerender } = await renderHook(
      (p: Props) =>
        useComposite({
          items,
          body: BODY_A,
          imageUris: p.imageUris ?? {},
          engine,
          settleMs: 0,
          ...(p.enabled === undefined ? {} : { enabled: p.enabled }),
        }),
      { initialProps: { imageUris: {} } as Props },
    );
    expect(result.current.busy).toBe(false);
    await rerender({ imageUris: uris, enabled: false });
    await new Promise((r) => setTimeout(r, 20));
    expect(compositor.calls).toBe(0);
    expect(result.current.busy).toBe(false);
    await rerender({ imageUris: uris, enabled: true });
    await waitFor(() => expect(result.current.uri).toBeDefined());
  });

  it('returns a cached picture on the first render, without merging again', async () => {
    const { compositor, engine } = setup();
    const first = await renderHook(() =>
      useComposite({ items, body: BODY_A, imageUris: uris, engine, settleMs: 0 }),
    );
    await waitFor(() => expect(first.result.current.uri).toBeDefined());
    const uri = first.result.current.uri;
    await first.unmount();
    const second = await renderHook(() =>
      useComposite({ items, body: BODY_A, imageUris: uris, engine, settleMs: 0 }),
    );
    expect(second.result.current).toEqual({ uri, busy: false });
    expect(compositor.calls).toBe(1);
  });

  it('drops the picture when the outfit changes and merges the new one', async () => {
    const { compositor, engine } = setup();
    const { result, rerender } = await renderHook(
      (p: Props) =>
        useComposite({
          items: p.items ?? items,
          body: BODY_A,
          imageUris: uris,
          engine,
          settleMs: 0,
        }),
      { initialProps: {} as Props },
    );
    await waitFor(() => expect(result.current.uri).toBeDefined());
    const before = result.current.uri;
    await rerender({ items: [tee] });
    expect(result.current.uri).toBeUndefined();
    await waitFor(() => expect(result.current.uri).toBeDefined());
    expect(result.current.uri).not.toBe(before);
    expect(compositor.calls).toBe(2);
  });

  it('waits for the inputs to settle before merging', async () => {
    jest.useFakeTimers();
    try {
      const { compositor, engine } = setup();
      const { rerender } = await renderHook(
        (p: Props) =>
          useComposite({ items: p.items ?? items, body: BODY_A, imageUris: uris, engine }),
        { initialProps: {} as Props },
      );
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      await rerender({ items: [tee] }); // a change restarts the wait
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      expect(compositor.calls).toBe(0);
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(compositor.calls).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does nothing where compositing is unavailable', async () => {
    const compositor = { ...createFakeOutfitCompositor(), available: false };
    const engine = createCompositeEngine(compositor);
    const { result } = await renderHook(() =>
      useComposite({ items, body: BODY_A, imageUris: uris, engine, settleMs: 0 }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toEqual({ busy: false });
    expect(compositor.calls).toBe(0);
  });
});
