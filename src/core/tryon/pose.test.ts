import type { Category, Item } from '../model/types';
import { syntheticPerson as person, type PersonOptions } from '../testing/poses';
import { anchorFor } from './anchors';
import { BODY_A, shoulderWidth } from './bodies';
import { placeOutfit } from './place';
import {
  BLOCKING_POSE_PROBLEMS,
  bodyCropWindow,
  checkLandmarks,
  defaultPhotoLandmarks,
  fromBlazePose,
  POSE_RULES,
  toCanvas,
} from './pose';

const analyse = (p: ReturnType<typeof person>) => fromBlazePose(p.keypoints, p.width, p.height);

describe('fromBlazePose mapping', () => {
  const r = analyse(person());
  const l = r.landmarks;

  it('finds a well-framed person with no problems', () => {
    expect(r.problems).toEqual([]);
    expect(l).toBeDefined();
  });

  it('swaps left and right: our L is the viewer left (smaller x)', () => {
    expect(l?.shoulderL.x).toBeLessThan(l?.shoulderR.x ?? 0);
    expect(l?.hipL.x).toBeLessThan(l?.hipR.x ?? 0);
    expect(l?.kneeL.x).toBeLessThan(l?.kneeR.x ?? 0);
    expect(l?.ankleL.x).toBeLessThan(l?.ankleR.x ?? 0);
    expect(l?.wristL.x).toBeLessThan(l?.wristR.x ?? 0);
    expect(l?.footL.x).toBeLessThan(l?.footR.x ?? 0);
  });

  it('converts to image pixels', () => {
    const p = person();
    const raw = p.keypoints[12]; // person's right shoulder = viewer's left
    expect(l?.shoulderL.x).toBeCloseTo(raw.x * 800);
    expect(l?.shoulderL.y).toBeCloseTo(raw.y * 1200);
  });

  it('puts feet at the midpoint of heel and foot index', () => {
    const p = person();
    const k = p.keypoints;
    expect(l?.footL.x).toBeCloseTo(((k[30].x + k[32].x) / 2) * 800);
    expect(l?.footL.y).toBeCloseTo(((k[30].y + k[32].y) / 2) * 1200);
    expect(l?.footR.y).toBeCloseTo(((k[29].y + k[31].y) / 2) * 1200);
  });

  it('puts eyeLine between the eyes', () => {
    const k = person().keypoints;
    expect(l?.eyeLine.x).toBeCloseTo(((k[2].x + k[5].x) / 2) * 800);
    expect(l?.eyeLine.y).toBeCloseTo(((k[2].y + k[5].y) / 2) * 1200);
  });

  it('derives neckBase: shoulder midpoint raised by 12% of shoulder-to-hip distance', () => {
    if (!l) throw new Error('no landmarks');
    const sy = (l.shoulderL.y + l.shoulderR.y) / 2;
    const hy = (l.hipL.y + l.hipR.y) / 2;
    expect(l.neckBase.x).toBeCloseTo((l.shoulderL.x + l.shoulderR.x) / 2);
    expect(l.neckBase.y).toBeCloseTo(sy - POSE_RULES.neckRaise * (hy - sy));
  });

  it('derives chin 45% of the eye-to-neck distance below the eyes', () => {
    if (!l) throw new Error('no landmarks');
    expect(l.chin.y).toBeCloseTo(l.eyeLine.y + 0.45 * (l.neckBase.y - l.eyeLine.y));
    expect(l.chin.y).toBeGreaterThan(l.eyeLine.y);
    expect(l.chin.y).toBeLessThan(l.neckBase.y);
  });

  it('derives headTop 0.9 × ear width above the eyes', () => {
    const p = person();
    const earWidth = (p.keypoints[7].x - p.keypoints[8].x) * 800;
    expect(l?.headTop.y).toBeCloseTo((l?.eyeLine.y ?? 0) - 0.9 * earWidth);
  });

  it('falls back to 0.55 × eye-to-chin when the ears are hidden', () => {
    const q = analyse(person({ hide: [7, 8] }));
    const e = q.landmarks;
    if (!e) throw new Error('no landmarks');
    expect(e.headTop.y).toBeCloseTo(e.eyeLine.y - 0.55 * (e.chin.y - e.eyeLine.y));
    expect(q.problems).toEqual([]);
  });

  it('places the waist on the shoulder-hip line at 62% with width 0.85 × hip width', () => {
    if (!l) throw new Error('no landmarks');
    expect(l.waistL.y).toBeCloseTo(l.shoulderL.y + 0.62 * (l.hipL.y - l.shoulderL.y));
    const waist = l.waistR.x - l.waistL.x;
    const hip = l.hipR.x - l.hipL.x;
    expect(waist).toBeCloseTo(0.85 * hip);
    expect((l.waistL.x + l.waistR.x) / 2).toBeCloseTo((l.hipL.x + l.hipR.x) / 2, 0);
  });

  it('reads a sensible proportion: eight-heads-ish figure, shoulders wider than hips', () => {
    if (!l) throw new Error('no landmarks');
    expect(shoulderWidth(l)).toBeGreaterThan(l.hipR.x - l.hipL.x);
    expect(l.headTop.y).toBeLessThan(l.eyeLine.y);
  });

  it('exposes the numeric rules in one table', () => {
    expect(POSE_RULES.minVisibility).toBe(0.5);
    expect(POSE_RULES.canvasWidth * 2).toBe(POSE_RULES.canvasHeight);
  });
});

describe('fromBlazePose at other sizes and positions', () => {
  it.each([
    { size: 0.9, cx: 0.5, top: 0.04 },
    { size: 0.65, cx: 0.3, top: 0.2 },
    { size: 0.75, cx: 0.7, top: 0.1 },
  ])('is clean for %j', (opt) => {
    const r = analyse(person(opt));
    expect(r.problems).toEqual([]);
    expect(r.landmarks?.shoulderL.x).toBeLessThan(r.landmarks?.shoulderR.x ?? 0);
  });

  it('scales landmarks with the person', () => {
    const big = analyse(person({ size: 0.9, top: 0.04 })).landmarks;
    const small = analyse(person({ size: 0.6, top: 0.1 })).landmarks;
    if (!big || !small) throw new Error('no landmarks');
    expect(shoulderWidth(big) / shoulderWidth(small)).toBeCloseTo(1.5, 1);
  });
});

describe('fromBlazePose problems', () => {
  it('reports no-person for an empty array and for too few keypoints', () => {
    expect(fromBlazePose([], 800, 1200)).toEqual({ problems: ['no-person'] });
    expect(fromBlazePose(person().keypoints.slice(0, 20), 800, 1200).problems).toEqual([
      'no-person',
    ]);
  });

  it('reports no-person for non-finite values or an empty image', () => {
    const p = person();
    p.keypoints[11] = { x: Number.NaN, y: 0.3, visibility: 1 };
    expect(analyse(p).problems).toEqual(['no-person']);
    expect(fromBlazePose(person().keypoints, 0, 0).problems).toEqual(['no-person']);
  });

  it('reports no-person when the torso is barely visible', () => {
    const r = analyse(person({ hide: [11, 12, 23, 24] }));
    expect(r.problems).toEqual(['no-person']);
    expect(r.landmarks).toBeUndefined();
    const all = person();
    all.keypoints.forEach((k) => (k.visibility = 0.1));
    expect(analyse(all).problems).toEqual(['no-person']);
  });

  it('reports feet-missing for cropped feet', () => {
    // Person runs off the bottom: feet hidden and below the frame.
    const r = analyse(person({ size: 1.1, top: 0.05, hide: [27, 28, 29, 30, 31, 32] }));
    expect(r.problems).toContain('feet-missing');
    expect(r.landmarks).toBeDefined();
  });

  it('reports feet-missing when a foot is below the image edge even if "visible"', () => {
    expect(analyse(person({ size: 0.97, top: 0.06 })).problems).toContain('feet-missing');
  });

  it('reports feet-missing when only one ankle is seen', () => {
    expect(analyse(person({ hide: [28] })).problems).toContain('feet-missing');
  });

  it('reports head-missing for a hidden head', () => {
    expect(analyse(person({ hide: [0, 2, 5] })).problems).toEqual(['head-missing']);
  });

  it('reports head-missing when the head top is above the image', () => {
    expect(analyse(person({ top: -0.02 })).problems).toContain('head-missing');
  });

  it('reports not-facing-camera for a person turned sideways', () => {
    const r = analyse(person({ turn: 0.15 }));
    expect(r.problems).toContain('not-facing-camera');
    expect(r.landmarks).toBeDefined();
  });

  it('reports not-facing-camera for a person facing away (left/right reversed)', () => {
    expect(analyse(person({ turn: -1 })).problems).toContain('not-facing-camera');
  });

  it('reports arms-too-close for arms down at the sides', () => {
    const r = analyse(person({ armSpread: 0.1 }));
    expect(r.problems).toEqual(['arms-too-close']);
  });

  it('does not flag raised hands as arms-too-close', () => {
    const p = person();
    p.keypoints[15] = { x: p.keypoints[23].x, y: 0.02, visibility: 0.9 };
    expect(analyse(p).problems).not.toContain('arms-too-close');
  });

  it('reports too-small when the person is under half the image height', () => {
    const r = analyse(person({ size: 0.4, top: 0.3 }));
    expect(r.problems).toEqual(['too-small']);
    expect(analyse(person({ size: 0.55, top: 0.2 })).problems).toEqual([]);
  });

  it('reports landmarks-out-of-order for a person lying down', () => {
    const p = person();
    // Rotate the pose a quarter turn: head to the left, feet to the right.
    for (const k of p.keypoints) {
      const { x, y } = k;
      k.x = y;
      k.y = x;
    }
    const r = fromBlazePose(p.keypoints, 1200, 800);
    expect(r.problems).toContain('landmarks-out-of-order');
  });

  it('only no-person and landmarks-out-of-order block saving', () => {
    expect([...BLOCKING_POSE_PROBLEMS].sort()).toEqual(['landmarks-out-of-order', 'no-person']);
  });
});

describe('checkLandmarks', () => {
  it('accepts the default body', () => {
    expect(checkLandmarks(BODY_A.landmarks)).toEqual([]);
    expect(checkLandmarks(defaultPhotoLandmarks())).toEqual([]);
  });

  it('flags a shuffled vertical order, e.g. knees dragged above the hips', () => {
    const l = defaultPhotoLandmarks();
    l.kneeL = { x: l.kneeL.x, y: 700 };
    l.kneeR = { x: l.kneeR.x, y: 700 };
    expect(checkLandmarks(l)).toContain('landmarks-out-of-order');
  });

  it('flags feet above the ankles', () => {
    const l = defaultPhotoLandmarks();
    l.footL = { x: l.footL.x, y: 1500 };
    l.footR = { x: l.footR.x, y: 1500 };
    expect(checkLandmarks(l)).toContain('landmarks-out-of-order');
  });

  it('flags head below the chin', () => {
    const l = defaultPhotoLandmarks();
    l.headTop = { x: 500, y: 330 };
    expect(checkLandmarks(l)).toContain('landmarks-out-of-order');
  });

  it('flags narrow shoulders and swapped sides', () => {
    const narrow = defaultPhotoLandmarks();
    narrow.shoulderL = { x: 480, y: 400 };
    narrow.shoulderR = { x: 520, y: 400 };
    expect(checkLandmarks(narrow)).toContain('not-facing-camera');
    const swapped = defaultPhotoLandmarks();
    [swapped.shoulderL, swapped.shoulderR] = [swapped.shoulderR, swapped.shoulderL];
    expect(checkLandmarks(swapped)).toContain('not-facing-camera');
  });

  it('flags wrists that touch the hips', () => {
    const l = defaultPhotoLandmarks();
    l.wristL = { x: l.hipL.x - 20, y: 1000 };
    expect(checkLandmarks(l)).toEqual(['arms-too-close']);
  });
});

describe('defaultPhotoLandmarks', () => {
  it("returns BODY_A's landmarks as an independent copy", () => {
    const l = defaultPhotoLandmarks();
    expect(l).toEqual(BODY_A.landmarks);
    l.headTop.y = 0;
    expect(BODY_A.landmarks.headTop.y).toBe(80);
  });
});

describe('bodyCropWindow', () => {
  const cases = [
    person(),
    person({ size: 0.6, cx: 0.3, top: 0.2 }),
    person({ size: 0.9, cx: 0.75, top: 0.03, width: 600, height: 1600 }),
    person({ size: 1.2, top: -0.1 }),
  ];

  it.each(cases.map((c, i) => [i, c] as const))('is 1:2, framed and hip-centred (%i)', (_i, p) => {
    const l = analyse(p).landmarks;
    if (!l) throw new Error('no landmarks');
    const w = bodyCropWindow(l);
    expect(w.height / w.width).toBeCloseTo(2, 9);
    const body = Math.max(l.footL.y, l.footR.y) - l.headTop.y;
    expect(l.headTop.y - w.y).toBeCloseTo(0.06 * body);
    expect(w.y + w.height - Math.max(l.footL.y, l.footR.y)).toBeCloseTo(0.04 * body);
    expect(w.x + w.width / 2).toBeCloseTo((l.hipL.x + l.hipR.x) / 2);
  });

  it('contains the whole person horizontally for a normal pose', () => {
    const l = analyse(person()).landmarks;
    if (!l) throw new Error('no landmarks');
    const w = bodyCropWindow(l);
    expect(l.wristL.x).toBeGreaterThan(w.x);
    expect(l.wristR.x).toBeLessThan(w.x + w.width);
  });

  it('can extend past the image edges for a person near the border', () => {
    const l = analyse(person({ size: 0.7, cx: 0.08 })).landmarks;
    if (!l) throw new Error('no landmarks');
    expect(bodyCropWindow(l).x).toBeLessThan(0);
  });

  it('never returns a zero-sized window', () => {
    const l = defaultPhotoLandmarks();
    for (const key of Object.keys(l) as (keyof typeof l)[]) l[key] = { x: 5, y: 5 };
    const w = bodyCropWindow(l);
    expect(w.height).toBeGreaterThan(0);
    expect(w.width).toBeGreaterThan(0);
  });
});

describe('toCanvas', () => {
  it('maps the window corners to the canvas corners', () => {
    const l = defaultPhotoLandmarks();
    const w = { x: 100, y: 50, width: 400, height: 800 };
    const c = toCanvas({ ...l, headTop: { x: 100, y: 50 }, footR: { x: 500, y: 850 } }, w);
    expect(c.headTop).toEqual({ x: 0, y: 0 });
    expect(c.footR).toEqual({ x: 1000, y: 2000 });
  });

  it('round-trips through the window', () => {
    const l = analyse(person({ size: 0.7, cx: 0.4 })).landmarks;
    if (!l) throw new Error('no landmarks');
    const w = bodyCropWindow(l);
    const c = toCanvas(l, w);
    for (const key of Object.keys(l) as (keyof typeof l)[]) {
      expect(c[key].x / (1000 / w.width) + w.x).toBeCloseTo(l[key].x, 6);
      expect(c[key].y / (2000 / w.height) + w.y).toBeCloseTo(l[key].y, 6);
    }
  });

  it('is independent of where and how big the person is in the photo', () => {
    const a = analyse(person({ size: 0.9, cx: 0.5, top: 0.04 })).landmarks;
    const b = analyse(person({ size: 0.6, cx: 0.3, top: 0.2 })).landmarks;
    if (!a || !b) throw new Error('no landmarks');
    const ca = toCanvas(a, bodyCropWindow(a));
    const cb = toCanvas(b, bodyCropWindow(b));
    for (const key of Object.keys(ca) as (keyof typeof ca)[]) {
      expect(ca[key].x).toBeCloseTo(cb[key].x, 3);
      expect(ca[key].y).toBeCloseTo(cb[key].y, 3);
    }
  });

  it('lands close to BODY_A proportions for a person filling the frame', () => {
    const l = analyse(person({ size: 0.9, top: 0.04 })).landmarks;
    if (!l) throw new Error('no landmarks');
    const c = toCanvas(l, bodyCropWindow(l));
    const ref = BODY_A.landmarks;
    expect(Math.abs(c.shoulderL.y - ref.shoulderL.y)).toBeLessThan(60);
    expect(Math.abs(c.hipL.y - ref.hipL.y)).toBeLessThan(60);
    expect(Math.abs(c.kneeL.y - ref.kneeL.y)).toBeLessThan(80);
    expect(Math.abs(c.ankleL.y - ref.ankleL.y)).toBeLessThan(80);
    expect(Math.abs(shoulderWidth(c) - shoulderWidth(ref))).toBeLessThan(60);
    expect(Math.abs(c.hipL.x - ref.hipL.x)).toBeLessThan(60);
    expect(c.headTop.y).toBeGreaterThan(0);
    expect(Math.max(c.footL.y, c.footR.y)).toBeLessThan(2000);
  });
});

describe('placement on a photo-derived body', () => {
  const tee: Item = {
    id: 'tee',
    createdAt: '',
    updatedAt: '',
    category: 'top' as Category,
    subcategory: 'tee',
    colors: [],
    pattern: 'solid',
    patternBold: false,
    formality: 2,
    warmth: 2,
    rainOk: false,
    sporty: false,
    status: 'active',
    favorite: false,
    layer: 'base',
    images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
    cutout: { aspectRatio: 1, hasAlpha: true },
  };

  function photoBody(opt: PersonOptions) {
    const l = analyse(person(opt)).landmarks;
    if (!l) throw new Error('no landmarks');
    return { id: 'photo', landmarks: toCanvas(l, bodyCropWindow(l)) };
  }

  it('anchors the shoulder slot at the person’s shoulders', () => {
    const body = photoBody({ size: 0.8 });
    const a = anchorFor('base', body);
    expect(a.width).toBeGreaterThan(0.8 * shoulderWidth(body.landmarks));
    expect(a.centerX).toBeCloseTo((body.landmarks.shoulderL.x + body.landmarks.shoulderR.x) / 2, 0);
  });

  it('makes the shirt wider for a person with broader shoulders', () => {
    const narrow = photoBody({ size: 0.8 });
    const broad = {
      id: 'photo',
      landmarks: {
        ...narrow.landmarks,
        shoulderL: { x: narrow.landmarks.shoulderL.x - 40, y: narrow.landmarks.shoulderL.y },
        shoulderR: { x: narrow.landmarks.shoulderR.x + 40, y: narrow.landmarks.shoulderR.y },
      },
    };
    const wNarrow = anchorFor('base', narrow).width;
    const wBroad = anchorFor('base', broad).width;
    expect(wBroad - wNarrow).toBeGreaterThan(40);
    expect(wBroad / wNarrow).toBeCloseTo(
      shoulderWidth(broad.landmarks) / shoulderWidth(narrow.landmarks),
      0,
    );
  });

  it('places an outfit on the body, inside the canvas, below the head', () => {
    const body = photoBody({ size: 0.7, cx: 0.4, top: 0.15 });
    const [p] = placeOutfit([tee], body);
    expect(p.itemId).toBe('tee');
    expect(p.width).toBeGreaterThan(0);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x + p.width).toBeLessThan(1000);
    expect(p.y).toBeGreaterThan(body.landmarks.chin.y - 100);
    expect(p.y).toBeLessThan(body.landmarks.hipL.y);
  });
});
