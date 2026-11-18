import { BODY_A } from '@/core/tryon/bodies';
import {
  CANVAS_UNITS,
  clampToCanvas,
  dragPoint,
  HANDLE_KEYS,
  HANDLE_LABELS,
  loupePosition,
  moveLandmark,
  pxToUnits,
  unitsToPx,
  withDerivedPoints,
} from './landmarkDrag';

describe('px and units', () => {
  it('convert both ways for any canvas width', () => {
    expect(pxToUnits(50, 500)).toBe(100);
    expect(unitsToPx(100, 500)).toBe(50);
    expect(unitsToPx(pxToUnits(37, 358), 358)).toBeCloseTo(37);
    expect(pxToUnits(10, 0)).toBe(0);
  });

  it('keeps points inside the canvas', () => {
    expect(clampToCanvas({ x: -5, y: 2500 })).toEqual({ x: 0, y: CANVAS_UNITS.height });
    expect(clampToCanvas({ x: 1200, y: -1 })).toEqual({ x: CANVAS_UNITS.width, y: 0 });
    expect(clampToCanvas({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });
});

describe('dragPoint', () => {
  it('moves by pointer travel scaled to units', () => {
    // 250 px wide canvas: 1 px = 4 units.
    expect(dragPoint({ x: 500, y: 400 }, 10, -5, 250)).toEqual({ x: 540, y: 380 });
  });

  it('clamps at the canvas edges', () => {
    expect(dragPoint({ x: 20, y: 20 }, -100, -100, 250)).toEqual({ x: 0, y: 0 });
    expect(dragPoint({ x: 980, y: 1990 }, 100, 100, 250)).toEqual({
      x: CANVAS_UNITS.width,
      y: CANVAS_UNITS.height,
    });
  });
});

describe('moveLandmark', () => {
  it('moves one handle and leaves the others', () => {
    const next = moveLandmark(BODY_A.landmarks, 'kneeL', { x: 400, y: 1380 });
    expect(next.kneeL).toEqual({ x: 400, y: 1380 });
    expect(next.kneeR).toEqual(BODY_A.landmarks.kneeR);
  });

  it('clamps the moved point', () => {
    expect(moveLandmark(BODY_A.landmarks, 'footL', { x: -50, y: 9999 }).footL).toEqual({
      x: 0,
      y: CANVAS_UNITS.height,
    });
  });

  it('keeps the neck base and eye line following the points that are dragged', () => {
    const l = withDerivedPoints(BODY_A.landmarks);
    expect(l.eyeLine).toEqual(BODY_A.landmarks.eyeLine); // BODY_A eyes are halfway down the head
    expect(l.neckBase.x).toBe(500);
    const lower = moveLandmark(BODY_A.landmarks, 'headTop', { x: 500, y: 40 });
    expect(lower.eyeLine.y).toBeCloseTo((40 + 312) / 2);
    const shrugged = moveLandmark(
      moveLandmark(BODY_A.landmarks, 'shoulderL', { x: 310, y: 440 }),
      'shoulderR',
      { x: 690, y: 440 },
    );
    expect(shrugged.neckBase.y).toBeGreaterThan(l.neckBase.y);
  });
});

describe('handles', () => {
  it('has a label for every handle, from the person’s point of view', () => {
    for (const key of HANDLE_KEYS) expect(HANDLE_LABELS[key]).toMatch(/^(Your|Top of your)/);
    // L = viewer's left = the person's right.
    expect(HANDLE_LABELS.shoulderL).toBe('Your right shoulder');
    expect(HANDLE_LABELS.shoulderR).toBe('Your left shoulder');
    expect(new Set(HANDLE_KEYS.map((k) => HANDLE_LABELS[k])).size).toBe(HANDLE_KEYS.length);
  });

  it('does not offer the derived points', () => {
    expect(HANDLE_KEYS).not.toContain('neckBase');
    expect(HANDLE_KEYS).not.toContain('eyeLine');
  });
});

describe('loupePosition', () => {
  const canvas = { width: 300, height: 600 };
  it('sits above the point and centred on it', () => {
    expect(loupePosition({ x: 150, y: 300 }, canvas, 100, 40)).toEqual({ x: 100, y: 160 });
  });
  it('drops below the point near the top and stays inside horizontally', () => {
    expect(loupePosition({ x: 5, y: 50 }, canvas, 100, 40)).toEqual({ x: 0, y: 90 });
    expect(loupePosition({ x: 295, y: 300 }, canvas, 100, 40).x).toBe(200);
  });
});
