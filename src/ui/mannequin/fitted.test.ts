import { fittedPlacement } from './fitted';

const layer = { uri: 'blob:x', bounds: { x: 200, y: 300, width: 400, height: 500 } };

describe('fittedPlacement', () => {
  it('uses the bounds as they are for an identity fit', () => {
    expect(fittedPlacement('a', layer, { dx: 0, dy: 0, scale: 1, rotation: 0 }, 7)).toEqual({
      itemId: 'a',
      x: 200,
      y: 300,
      width: 400,
      height: 500,
      rotation: 0,
      z: 7,
    });
  });

  it('scales about the top centre, then nudges and rotates', () => {
    const p = fittedPlacement('a', layer, { dx: 10, dy: -20, scale: 1.5, rotation: 8 }, 3);
    expect(p.width).toBe(600);
    expect(p.height).toBe(750);
    // centre stays at x = 400 (plus the nudge); the top edge stays at y = 300 (plus the nudge)
    expect(p.x + p.width / 2).toBe(410);
    expect(p.y).toBe(280);
    expect(p.rotation).toBe(8);
  });
});
