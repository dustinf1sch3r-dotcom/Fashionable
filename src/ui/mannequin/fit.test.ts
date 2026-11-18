import { FIT_LIMITS, IDENTITY_FIT } from '@/core/tryon/place';
import { newOutfit } from '@/core/model/factories';
import { fixedClock } from '@/core/testing/clock';
import { fixtureById } from '@/core/testing/fixtures';
import {
  angleDelta,
  applyGesture,
  canStep,
  effectiveFit,
  FIT_STEPS,
  pxToUnits,
  stepFit,
  unitsToPx,
  type GestureBase,
} from './fit';

describe('px <-> mannequin units', () => {
  it('maps the 1000-unit canvas width onto the rendered width', () => {
    expect(pxToUnits(100, 500)).toBe(200);
    expect(pxToUnits(10, 200)).toBe(50);
    expect(unitsToPx(200, 500)).toBe(100);
    expect(unitsToPx(pxToUnits(37, 173), 173)).toBeCloseTo(37, 9);
  });

  it('is safe before the mannequin has been measured', () => {
    expect(pxToUnits(10, 0)).toBe(0);
    expect(unitsToPx(10, 0)).toBe(0);
  });
});

describe('stepFit', () => {
  it('moves by one step per press', () => {
    expect(stepFit(IDENTITY_FIT, 'scale-up').scale).toBeCloseTo(1 + FIT_STEPS.scale, 6);
    expect(stepFit(IDENTITY_FIT, 'scale-down').scale).toBeCloseTo(1 - FIT_STEPS.scale, 6);
    expect(stepFit(IDENTITY_FIT, 'rotate-left').rotation).toBe(-5);
    expect(stepFit(IDENTITY_FIT, 'rotate-right').rotation).toBe(5);
    expect(stepFit(IDENTITY_FIT, 'up').dy).toBe(-FIT_STEPS.nudge);
    expect(stepFit(IDENTITY_FIT, 'down').dy).toBe(FIT_STEPS.nudge);
    expect(stepFit(IDENTITY_FIT, 'left').dx).toBe(-FIT_STEPS.nudge);
    expect(stepFit(IDENTITY_FIT, 'right').dx).toBe(FIT_STEPS.nudge);
  });

  it('never leaves the TRY_ON limits and reports when a limit is reached', () => {
    let fit = IDENTITY_FIT;
    for (let i = 0; i < 100; i++) fit = stepFit(fit, 'scale-up');
    expect(fit.scale).toBe(FIT_LIMITS.scale.max);
    expect(canStep(fit, 'scale-up')).toBe(false);
    expect(canStep(fit, 'scale-down')).toBe(true);
    for (let i = 0; i < 100; i++) fit = stepFit(fit, 'rotate-left');
    expect(fit.rotation).toBe(-FIT_LIMITS.rotation);
    for (let i = 0; i < 100; i++) fit = stepFit(fit, 'right');
    expect(fit.dx).toBe(FIT_LIMITS.offset);
  });

  it('keeps tidy numbers after many steps', () => {
    let fit = IDENTITY_FIT;
    for (let i = 0; i < 7; i++) fit = stepFit(fit, 'scale-up');
    expect(fit.scale).toBe(1.35);
  });
});

describe('angleDelta', () => {
  it('takes the short way round', () => {
    expect(angleDelta(10, 40)).toBe(30);
    expect(angleDelta(170, -170)).toBe(20);
    expect(angleDelta(-170, 170)).toBe(-20);
    expect(angleDelta(0, 180)).toBe(180);
  });
});

describe('applyGesture', () => {
  const base: GestureBase = { fit: IDENTITY_FIT, panX: 0, panY: 0 };

  it('drags in mannequin units, converted from screen pixels', () => {
    const fit = applyGesture(base, { panX: 25, panY: -10 }, 250);
    expect(fit).toMatchObject({ dx: 100, dy: -40, scale: 1, rotation: 0 });
  });

  it('adds to the fit the gesture started from', () => {
    const start: GestureBase = {
      fit: { dx: 50, dy: 0, scale: 1.2, rotation: 5 },
      panX: 10,
      panY: 10,
    };
    const fit = applyGesture(start, { panX: 20, panY: 10 }, 500);
    expect(fit).toEqual({ dx: 70, dy: 0, scale: 1.2, rotation: 5 });
  });

  it('pinch scales by the change in finger distance, twist rotates by the change in angle', () => {
    const start: GestureBase = { ...base, distance: 100, angle: 0 };
    const fit = applyGesture(start, { panX: 0, panY: 0, distance: 150, angle: 12 }, 400);
    expect(fit.scale).toBe(1.5);
    expect(fit.rotation).toBe(12);
  });

  it('ignores finger geometry when the gesture began with one finger', () => {
    const fit = applyGesture(base, { panX: 0, panY: 0, distance: 150, angle: 12 }, 400);
    expect(fit).toEqual(IDENTITY_FIT);
  });

  it('clamps to the limits', () => {
    const start: GestureBase = { ...base, distance: 10, angle: 0 };
    const fit = applyGesture(start, { panX: 9999, panY: -9999, distance: 1000, angle: 90 }, 300);
    expect(fit).toEqual({
      dx: FIT_LIMITS.offset,
      dy: -FIT_LIMITS.offset,
      scale: FIT_LIMITS.scale.max,
      rotation: FIT_LIMITS.rotation,
    });
  });
});

describe('effectiveFit', () => {
  const tee = { ...fixtureById('tee-white'), fitAdjust: { dx: 5, dy: 6, scale: 1.1, rotation: 2 } };
  const mk = (fitOverrides?: Record<string, typeof IDENTITY_FIT>) =>
    newOutfit({ itemIds: [tee.id], fitOverrides }, fixedClock('2026-01-01T00:00:00.000Z'), {
      uuid: () => 'o',
    });

  it('prefers the outfit override, then the saved fit, then identity', () => {
    const override = { dx: 1, dy: 2, scale: 0.9, rotation: -3 };
    expect(effectiveFit(tee, mk({ [tee.id]: override }))).toEqual(override);
    expect(effectiveFit(tee, mk())).toEqual(tee.fitAdjust);
    expect(effectiveFit(tee)).toEqual(tee.fitAdjust);
    expect(effectiveFit(fixtureById('tee-white'))).toEqual(IDENTITY_FIT);
  });
});
