import type { Outfit } from '@/core/model/types';
import { fixtureById } from '@/core/testing/fixtures';
import { BODY_A } from '@/core/tryon/bodies';
import { placeOutfit } from '@/core/tryon/place';
import { compositeKey, mergeLayers, seedFor } from './layers';

const tee = fixtureById('tee-white');
const jeans = fixtureById('jeans-dark');
const shoes = fixtureById('sneakers-white');
const items = [tee, jeans, shoes];
const uris = Object.fromEntries(items.map((i) => [i.images.cutoutId, `blob:${i.id}`]));

describe('mergeLayers', () => {
  it('lists every item bottom to top, rigid ones inside their placement box', () => {
    const layers = mergeLayers(items, BODY_A, undefined, uris, undefined);
    expect(layers?.map((l) => l.uri)).toEqual(
      placeOutfit(items, BODY_A)
        .sort((a, b) => a.z - b.z)
        .map((p) => `blob:${p.itemId}`),
    );
    for (const layer of layers ?? []) {
      const item = items.find((i) => `blob:${i.id}` === layer.uri);
      const p = placeOutfit(items, BODY_A).find((q) => q.itemId === item?.id);
      expect(layer.width / layer.height).toBeCloseTo(item?.cutout.aspectRatio ?? 0, 3);
      expect(layer.x).toBeGreaterThanOrEqual((p?.x ?? 0) - 0.001);
      expect(layer.x + layer.width).toBeLessThanOrEqual((p?.x ?? 0) + (p?.width ?? 0) + 0.001);
      expect(layer.y + layer.height).toBeLessThanOrEqual((p?.y ?? 0) + (p?.height ?? 0) + 0.001);
    }
  });

  it('uses the warped image at its own bounds, with the item fit on top', () => {
    const fitted = {
      [tee.id]: { uri: 'blob:fit', bounds: { x: 300, y: 400, width: 400, height: 500 } },
    };
    const plain = mergeLayers(items, BODY_A, undefined, uris, fitted)?.find(
      (l) => l.uri === 'blob:fit',
    );
    expect(plain).toMatchObject({ x: 300, y: 400, width: 400, height: 500, rotation: 0 });
    const outfit = {
      fitOverrides: { [tee.id]: { dx: 20, dy: -10, scale: 1, rotation: 5 } },
    } as unknown as Outfit;
    const moved = mergeLayers(items, BODY_A, outfit, uris, fitted)?.find(
      (l) => l.uri === 'blob:fit',
    );
    expect(moved).toMatchObject({ x: 320, y: 390, rotation: 5 });
  });

  it('is not ready while a rigid item has no picture', () => {
    expect(
      mergeLayers(
        items,
        BODY_A,
        undefined,
        { ...uris, [shoes.images.cutoutId]: undefined },
        undefined,
      ),
    ).toBeUndefined();
    // A warped image does not need the rigid cutout URI.
    const fitted = { [tee.id]: { uri: 'blob:fit', bounds: { x: 0, y: 0, width: 10, height: 10 } } };
    expect(mergeLayers([tee], BODY_A, undefined, {}, fitted)?.map((l) => l.uri)).toEqual([
      'blob:fit',
    ]);
  });
});

describe('compositeKey', () => {
  const layers = mergeLayers(items, BODY_A, undefined, uris, undefined) ?? [];
  const base = { backdrop: 'silhouette:body-a:#fff', bodySig: 'abc', layers, density: 0.5 };

  it('is stable for the same parts', () => {
    expect(compositeKey(base)).toBe(compositeKey({ ...base, layers: [...layers] }));
    expect(seedFor(compositeKey(base))).toBe(seedFor(compositeKey(base)));
  });

  it('changes with the backdrop, body, density and every layer', () => {
    const key = compositeKey(base);
    expect(compositeKey({ ...base, backdrop: 'photo:blob:me' })).not.toBe(key);
    expect(compositeKey({ ...base, bodySig: 'abd' })).not.toBe(key);
    expect(compositeKey({ ...base, density: 1 })).not.toBe(key);
    expect(compositeKey({ ...base, layers: layers.slice(1) })).not.toBe(key);
    const tweaked = mergeLayers(
      [{ ...tee, fitAdjust: { dx: 30, dy: 0, scale: 1, rotation: 0 } }, jeans, shoes],
      BODY_A,
      undefined,
      uris,
      undefined,
    );
    expect(compositeKey({ ...base, layers: tweaked ?? [] })).not.toBe(key);
    expect(compositeKey({ ...base, layers: [...layers].reverse() })).not.toBe(key);
  });
});
