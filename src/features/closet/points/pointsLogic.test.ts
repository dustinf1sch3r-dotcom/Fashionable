import type { GarmentRig } from '@/core/model/types';
import {
  asEdited,
  containBox,
  fromBoxPx,
  movePoint,
  orderedPointNames,
  pointLabel,
  samePoints,
  toBoxPx,
} from './pointsLogic';

const rig: GarmentRig = {
  kind: 'top',
  version: 1,
  confidence: 0.4,
  edited: false,
  points: {
    hemL: { x: 0.2, y: 0.9 },
    neckL: { x: 0.4, y: 0.1 },
    odd: { x: 0.5, y: 0.5 },
  },
};

describe('orderedPointNames', () => {
  it('follows the rig kind order, keeps only present points and appends unknown ones', () => {
    expect(orderedPointNames(rig, ['neckL', 'neckR', 'hemL'])).toEqual(['neckL', 'hemL', 'odd']);
  });
});

describe('containBox', () => {
  it('fits the picture inside the area, centred', () => {
    expect(containBox(200, 400, 0.5)).toEqual({ x: 0, y: 0, width: 200, height: 400 });
    const wide = containBox(300, 100, 2);
    expect(wide).toEqual({ x: 50, y: 0, width: 200, height: 100 });
    const tall = containBox(300, 300, 0.5);
    expect(tall).toEqual({ x: 75, y: 0, width: 150, height: 300 });
  });
  it('gives an empty box for an unmeasured area', () => {
    expect(containBox(0, 100, 1).width).toBe(0);
  });
});

describe('dragging maths', () => {
  const box = { x: 10, y: 20, width: 200, height: 400 };
  it('converts between normalised points and box pixels', () => {
    expect(toBoxPx({ x: 0.5, y: 0.25 }, box)).toEqual({ x: 100, y: 100 });
    expect(fromBoxPx({ x: 100, y: 100 }, box)).toEqual({ x: 0.5, y: 0.25 });
  });
  it('keeps dragged points inside the picture', () => {
    expect(fromBoxPx({ x: -50, y: 900 }, box)).toEqual({ x: 0, y: 1 });
    expect(movePoint(rig, 'neckL', { x: 1.4, y: -2 }).points.neckL).toEqual({ x: 1, y: 0 });
  });
  it('moves one point and nothing else, and ignores unknown names', () => {
    const moved = movePoint(rig, 'neckL', { x: 0.45, y: 0.12 });
    expect(moved.points.neckL).toEqual({ x: 0.45, y: 0.12 });
    expect(moved.points.hemL).toBe(rig.points.hemL);
    expect(movePoint(rig, 'nope', { x: 0, y: 0 })).toBe(rig);
    expect(rig.points.neckL).toEqual({ x: 0.4, y: 0.1 });
  });
});

describe('samePoints / asEdited / labels', () => {
  it('compares points only', () => {
    expect(samePoints(rig, { ...rig, confidence: 1, edited: true })).toBe(true);
    expect(samePoints(rig, movePoint(rig, 'odd', { x: 0.6, y: 0.5 }))).toBe(false);
  });
  it('marks a rig as edited without touching its points', () => {
    const e = asEdited(rig);
    expect(e.edited).toBe(true);
    expect(e.points).toBe(rig.points);
  });
  it('labels from the viewer side and falls back to the raw name', () => {
    expect(pointLabel('shoulderL')).toBe('Left shoulder');
    expect(pointLabel('weird')).toBe('weird');
  });
});
