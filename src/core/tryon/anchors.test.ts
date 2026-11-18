import { anchorFor, feetUsable, ANCHOR_RULES } from './anchors';
import { BODY_A } from './bodies';
import type { Slot } from '../model/types';

const SLOTS: Slot[] = [
  'base',
  'mid',
  'bottom',
  'onepiece',
  'outer',
  'shoes',
  'legs',
  'belt',
  'bag',
  'head',
  'neck',
  'eyes',
  'wrist',
  'jewelry',
];

describe('anchors', () => {
  it('ANCHOR_RULES snapshot', () => {
    expect(ANCHOR_RULES).toMatchSnapshot();
  });

  it.each(SLOTS)('anchorFor(%s) on BODY_A snapshot', (slot) => {
    expect(anchorFor(slot, BODY_A)).toMatchSnapshot();
  });

  it('matches the spec table by hand for a few slots', () => {
    expect(anchorFor('base', BODY_A)).toEqual({
      centerX: 500,
      topY: 362,
      width: 380 * 1.55,
      z: 40,
    });
    expect(anchorFor('bottom', BODY_A)).toEqual({
      centerX: 500,
      topY: 780,
      width: 340 * 1.25,
      z: 30,
    });
    // ankle.y 1860 − 30; foot gap 220 + 120 (tuned down from +220: shoes were wider than the calves).
    expect(anchorFor('shoes', BODY_A)).toEqual({ centerX: 500, topY: 1830, width: 340, z: 35 });
    expect(anchorFor('bag', BODY_A)).toEqual({ centerX: 850, topY: 980, width: 260, z: 80 });
    expect(anchorFor('wrist', BODY_A)).toEqual({ centerX: 210, topY: 1010, width: 70, z: 75 });
  });

  it('uses the average of L and R for knee/ankle/waist', () => {
    const l = BODY_A.landmarks;
    const body = {
      ...BODY_A,
      landmarks: { ...l, kneeL: { x: 420, y: 1300 }, kneeR: { x: 580, y: 1500 } },
    };
    expect(anchorFor('legs', body).topY).toBe(1400);
  });

  it('gives every slot a distinct-or-intended z, ordered as the spec', () => {
    const z = (s: Slot): number => anchorFor(s, BODY_A).z;
    expect(z('legs')).toBeLessThan(z('shoes'));
    // Shoes go over trouser hems (otherwise hidden), still under tops and dresses.
    expect(z('shoes')).toBeGreaterThan(z('bottom'));
    expect(z('shoes')).toBeLessThan(z('base'));
    expect(z('bottom')).toBeLessThan(z('base'));
    expect(z('base')).toBeLessThan(z('belt'));
    expect(z('belt')).toBeLessThan(z('mid'));
    expect(z('mid')).toBeLessThan(z('outer'));
    expect(z('outer')).toBeLessThan(z('neck'));
    expect(z('neck')).toBeLessThan(z('jewelry'));
    expect(z('jewelry')).toBeLessThan(z('wrist'));
    expect(z('wrist')).toBeLessThan(z('bag'));
    expect(z('bag')).toBeLessThan(z('head'));
    expect(z('head')).toBeLessThan(z('eyes'));
  });
});

describe('shoes when the photo cut the feet off', () => {
  const l = BODY_A.landmarks;
  // Pose detection extrapolated both feet far below the 2000-unit canvas.
  const cutOff = {
    ...BODY_A,
    landmarks: {
      ...l,
      footL: { x: 380, y: 2300 },
      footR: { x: 760, y: 2300 },
    },
  };

  it('knows when the feet are usable', () => {
    expect(feetUsable(l)).toBe(true);
    expect(feetUsable(cutOff.landmarks)).toBe(false);
    expect(feetUsable({ ...l, footL: { x: -40, y: 1900 } })).toBe(false);
  });

  it('places the shoes from the ankles, not from the extrapolated feet', () => {
    const a = anchorFor('shoes', cutOff);
    const ankleGap = l.ankleR.x - l.ankleL.x;
    expect(a.topY).toBe(1830);
    expect(a.width).toBe(ankleGap + 120);
    expect(a.centerX).toBe(anchorFor('shoes', BODY_A).centerX);
  });
});
