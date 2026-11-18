import { compositeOutfit } from './index';
import type { CompositeInput, RGBAImage } from './index';
import { fill, meanRect, noisy, px, solid } from './testUtils';

const opaqueRect = (w: number, h: number, c: [number, number, number]): RGBAImage =>
  solid(w, h, [...c, 255]);

function input(over: Partial<CompositeInput> = {}): CompositeInput {
  return {
    backdrop: solid(100, 120, [128, 128, 128, 255]),
    kind: 'photo',
    layers: [{ image: opaqueRect(40, 50, [240, 240, 240]), x: 30, y: 30 }],
    density: 1,
    seed: 5,
    ...over,
  };
}

describe('compositeOutfit', () => {
  it('returns an image of the backdrop size and does not mutate inputs', () => {
    const inp = input({ backdrop: noisy(100, 120, [128, 128, 128], 3) });
    const bd = Uint8ClampedArray.from(inp.backdrop.data);
    const ld = Uint8ClampedArray.from(inp.layers[0]?.image.data ?? []);
    const out = compositeOutfit(inp);
    expect(out.width).toBe(100);
    expect(out.height).toBe(120);
    expect(out.data).toHaveLength(100 * 120 * 4);
    expect(out.data).not.toBe(inp.backdrop.data);
    expect(Array.from(inp.backdrop.data)).toEqual(Array.from(bd));
    expect(Array.from(inp.layers[0]?.image.data ?? [])).toEqual(Array.from(ld));
  });

  it('is deterministic for a seed, differs (grain) for another', () => {
    const base = noisy(100, 120, [128, 128, 128], 4);
    const a = compositeOutfit(input({ backdrop: base, seed: 1 }));
    const b = compositeOutfit(input({ backdrop: base, seed: 1 }));
    const c = compositeOutfit(input({ backdrop: base, seed: 2 }));
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data));
  });

  it('no layers: the output equals the backdrop', () => {
    const bd = noisy(30, 30, [90, 100, 110], 5);
    expect(Array.from(compositeOutfit(input({ backdrop: bd, layers: [] })).data)).toEqual(
      Array.from(bd.data),
    );
  });

  it('a fully transparent layer changes nothing (no shadow either)', () => {
    const bd = noisy(60, 60, [120, 120, 120], 3);
    const out = compositeOutfit(
      input({ backdrop: bd, layers: [{ image: solid(30, 30, [255, 0, 0, 0]), x: 10, y: 10 }] }),
    );
    expect(Array.from(out.data)).toEqual(Array.from(bd.data));
  });

  it('a layer entirely off-canvas changes nothing; a partly off-canvas layer is clipped', () => {
    const bd = solid(60, 60, [120, 120, 120, 255]);
    const off = compositeOutfit(
      input({
        backdrop: bd,
        layers: [{ image: opaqueRect(20, 20, [255, 255, 255]), x: 200, y: -50 }],
      }),
    );
    expect(Array.from(off.data)).toEqual(Array.from(bd.data));
    const part = compositeOutfit(
      input({
        backdrop: bd,
        layers: [
          { image: opaqueRect(40, 40, [255, 255, 255]), x: -20, y: 40 },
          { image: opaqueRect(40, 40, [255, 255, 255]), x: 50, y: -30 },
        ],
      }),
    );
    expect(part.width).toBe(60);
    expect(px(part, 5, 50)[0]).toBeGreaterThan(150);
    expect(px(part, 55, 5)[0]).toBeGreaterThan(150);
    expect(px(part, 30, 30)[0]).toBeCloseTo(120, 0);
  });

  it('the garment covers the backdrop where opaque and stays white-ish on a neutral photo', () => {
    const out = compositeOutfit(input());
    const [r, g, b, a] = px(out, 50, 55);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(200);
    expect(Math.abs(r - b)).toBeLessThan(6);
    expect(g).toBeGreaterThan(200);
  });

  it('golden: a white tee on a mid-grey photo with a darker left half ends up darker on the left', () => {
    const photo = fill(120, 140, (x) => (x < 60 ? [90, 90, 90, 255] : [150, 150, 150, 255]));
    const out = compositeOutfit({
      backdrop: photo,
      kind: 'photo',
      layers: [{ image: opaqueRect(80, 90, [245, 245, 245]), x: 20, y: 25 }],
      density: 1,
      seed: 3,
    });
    const left = meanRect(out, 30, 40, 55, 100);
    const right = meanRect(out, 65, 40, 90, 100);
    expect(left).toBeLessThan(right - 15);
    expect(left).toBeGreaterThan(130); // still reads as white-ish, not grey
    // The garment is brighter than the backdrop either side.
    expect(right).toBeGreaterThan(180);
  });

  it('colour matching: a white tee on a warm dim photo is slightly warm and darker but still white', () => {
    const photo = solid(100, 120, [110, 88, 66, 255]);
    const out = compositeOutfit(input({ backdrop: photo }));
    const [r, g, b] = px(out, 50, 55);
    expect(r).toBeGreaterThan(b + 8);
    expect(r).toBeLessThan(240);
    expect(Math.min(r, g, b)).toBeGreaterThan(170);
  });

  it('shading: a dark band under the garment darkens that band of the garment', () => {
    const photo = fill(100, 120, (x) =>
      x >= 45 && x < 55 ? [70, 70, 70, 255] : [140, 140, 140, 255],
    );
    const out = compositeOutfit(input({ backdrop: photo }));
    expect(meanRect(out, 47, 50, 53, 80)).toBeLessThan(meanRect(out, 33, 50, 39, 80) - 12);
  });

  it('silhouette: no cast, edges of a garment darker than its centre; contact shadow is lighter', () => {
    const sil = solid(100, 120, [200, 200, 200, 255]);
    const out = compositeOutfit(
      input({
        backdrop: sil,
        kind: 'silhouette',
        layers: [{ image: opaqueRect(60, 80, [220, 100, 100]), x: 20, y: 20 }],
      }),
    );
    expect(px(out, 50, 60)[0]).toBeGreaterThan(px(out, 22, 60)[0]);
    const shadowed = px(out, 19, 60)[0];
    expect(shadowed).toBeLessThan(200);
    expect(shadowed).toBeGreaterThan(200 * 0.8);
  });

  it('contact shadow darkens the backdrop around the layer, fading with distance', () => {
    const out = compositeOutfit({
      backdrop: solid(300, 300, [200, 200, 200, 255]),
      kind: 'silhouette',
      layers: [{ image: opaqueRect(100, 100, [240, 240, 240]), x: 100, y: 100 }],
      density: 1,
      seed: 1,
    });
    const near = px(out, 98, 150)[0];
    const mid = px(out, 92, 150)[0];
    expect(near).toBeLessThan(195);
    expect(near).toBeGreaterThan(200 * 0.8);
    expect(mid).toBeGreaterThan(near);
    expect(px(out, 10, 10)[0]).toBe(200);
  });

  it('photo: nothing brighter than the backdrop appears outside the garment halo', () => {
    const out = compositeOutfit(input({ backdrop: solid(300, 300, [128, 128, 128, 255]) }));
    expect(px(out, 2, 2)[0]).toBe(128);
    expect(px(out, 299, 299)[0]).toBe(128);
  });

  it('a lower layer is also shadowed by the layer above', () => {
    const bd = solid(100, 120, [128, 128, 128, 255]);
    const big: RGBAImage = opaqueRect(70, 90, [240, 240, 240]);
    const alone = compositeOutfit(input({ backdrop: bd, layers: [{ image: big, x: 10, y: 10 }] }));
    const stacked = compositeOutfit(
      input({
        backdrop: bd,
        layers: [
          { image: big, x: 10, y: 10 },
          { image: opaqueRect(20, 20, [240, 240, 240]), x: 35, y: 45 },
        ],
      }),
    );
    expect(px(stacked, 33, 55)[0]).toBeLessThan(px(alone, 33, 55)[0]);
  });

  it('alpha over is correct: no dark fringe from transparent black pixels, edge between garment and backdrop', () => {
    // Garment pixels are bright; its transparent surround is black with alpha 0.
    const garment = fill(40, 40, (x, y) =>
      x >= 10 && x < 30 && y >= 10 && y < 30 ? [250, 250, 250, 255] : [0, 0, 0, 0],
    );
    const bd = solid(60, 60, [250, 250, 250, 255]);
    const out = compositeOutfit(
      input({ backdrop: bd, kind: 'silhouette', layers: [{ image: garment, x: 10, y: 10 }] }),
    );
    // The pixel on the garment's feathered edge must not be darker than the contact shadow allows.
    const edge = px(out, 19, 30)[0]; // half-covered edge column
    expect(edge).toBeGreaterThan(200);
  });

  it('half-transparent layer blends with the backdrop and output alpha stays valid', () => {
    const half = solid(30, 30, [255, 255, 255, 128]);
    const out = compositeOutfit(
      input({
        backdrop: solid(60, 60, [100, 100, 100, 255]),
        kind: 'silhouette',
        layers: [{ image: half, x: 15, y: 15 }],
      }),
    );
    const c = px(out, 30, 30);
    expect(c[3]).toBe(255);
    expect(c[0]).toBeGreaterThan(150);
    expect(c[0]).toBeLessThan(220);
  });

  it('a transparent backdrop becomes opaque only under layers', () => {
    const out = compositeOutfit(
      input({
        backdrop: solid(50, 50, [0, 0, 0, 0]),
        kind: 'silhouette',
        layers: [{ image: opaqueRect(20, 20, [200, 50, 50]), x: 10, y: 10 }],
      }),
    );
    expect(px(out, 20, 20)[3]).toBe(255);
    expect(px(out, 45, 45)[3]).toBe(0);
  });

  it('rounds sub-pixel positions and handles a layer larger than the canvas', () => {
    const out = compositeOutfit(
      input({
        backdrop: solid(20, 20, [100, 100, 100, 255]),
        layers: [{ image: opaqueRect(60, 60, [240, 240, 240]), x: -10.4, y: -9.6 }],
      }),
    );
    expect(px(out, 10, 10)[0]).toBeGreaterThan(190);
  });

  it('grain: a noisy photo gives the garment grain, a clean one leaves it smooth', () => {
    const noisyOut = compositeOutfit(input({ backdrop: noisy(100, 120, [128, 128, 128], 5, 2) }));
    const cleanOut = compositeOutfit(input());
    const spread = (img: RGBAImage): number => {
      let s = 0;
      let s2 = 0;
      let n = 0;
      for (let y = 45; y < 65; y++) {
        for (let x = 40; x < 60; x++) {
          const v = px(img, x, y)[0];
          s += v;
          s2 += v * v;
          n++;
        }
      }
      return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
    };
    expect(spread(noisyOut)).toBeGreaterThan(2);
    expect(spread(cleanOut)).toBeLessThan(0.5);
  });
});
