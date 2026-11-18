import { newFeedback, newItem, newOutfit, newProfile, newWearLog } from './factories';
import { fakeClock, fakeIds } from './testHelpers';
import {
  isFeedback,
  isItem,
  isOutfit,
  isProfile,
  isWearLog,
  validateFeedback,
  validateItem,
  validateOutfit,
  validateProfile,
  validateWearLog,
  type ValidationResult,
} from './validate';

const clock = fakeClock();
const ids = fakeIds();

function item() {
  return newItem(
    {
      category: 'top',
      subcategory: 'tshirt',
      colors: [{ hex: '#ffffff', share: 1, name: 'white' }],
      images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
      cutout: { aspectRatio: 1.2, hasAlpha: true },
    },
    clock,
    ids,
  );
}
const point = { x: 1, y: 2 };
const landmarks = Object.fromEntries(
  [
    'headTop',
    'chin',
    'eyeLine',
    'neckBase',
    'shoulderL',
    'shoulderR',
    'waistL',
    'waistR',
    'hipL',
    'hipR',
    'kneeL',
    'kneeR',
    'ankleL',
    'ankleR',
    'wristL',
    'wristR',
    'footL',
    'footR',
  ].map((k) => [k, point]),
);

function paths(r: ValidationResult<unknown>): string[] {
  return r.ok ? [] : r.problems.map((p) => p.path);
}
function expectBad(r: ValidationResult<unknown>, path: string, code?: string) {
  expect(r.ok).toBe(false);
  if (r.ok) return;
  const hit = r.problems.find((p) => p.path === path);
  expect(hit).toBeDefined();
  if (code) expect(hit?.code).toBe(code);
}
const mutate = <T extends object>(o: T, patch: Record<string, unknown>) => ({ ...o, ...patch });
const without = <T extends object>(o: T, key: string) => {
  const c = { ...o } as Record<string, unknown>;
  delete c[key];
  return c;
};

describe('non-object input', () => {
  it.each([null, undefined, 5, 'x', [], true])('rejects %p', (v) => {
    for (const f of [
      validateItem,
      validateOutfit,
      validateWearLog,
      validateFeedback,
      validateProfile,
    ]) {
      expect(f(v)).toEqual({ ok: false, problems: [{ path: '', code: 'wrong_type' }] });
    }
  });
});

describe('entity base fields', () => {
  const base = newOutfit({ itemIds: ['a'] }, clock, ids);
  it('accepts a valid entity with deletedAt', () => {
    const r = validateOutfit({ ...base, deletedAt: '2026-01-16T00:00:00Z' });
    expect(r.ok).toBe(true);
    expect(validateOutfit({ ...base, createdAt: '2026-01-16T00:00:00+02:00' }).ok).toBe(true);
  });
  it('rejects bad id and timestamps', () => {
    expectBad(validateOutfit(without(base, 'id')), 'id', 'missing');
    expectBad(validateOutfit(mutate(base, { id: '' })), 'id', 'invalid_value');
    expectBad(validateOutfit(mutate(base, { id: 5 })), 'id', 'wrong_type');
    expectBad(validateOutfit(without(base, 'createdAt')), 'createdAt', 'missing');
    expectBad(
      validateOutfit(mutate(base, { createdAt: 'yesterday' })),
      'createdAt',
      'invalid_format',
    );
    expectBad(
      validateOutfit(mutate(base, { updatedAt: '2026-13-45T00:00:00Z' })),
      'updatedAt',
      'invalid_format',
    );
    expectBad(validateOutfit(mutate(base, { updatedAt: 12 })), 'updatedAt', 'wrong_type');
    expectBad(
      validateOutfit(mutate(base, { deletedAt: '2026-01-01' })),
      'deletedAt',
      'invalid_format',
    );
  });
});

describe('validateItem', () => {
  it('accepts a factory item and a fully populated one', () => {
    const full = {
      ...item(),
      name: 'n',
      material: 'cotton',
      metal: 'gold',
      brand: 'b',
      notes: 'n',
      pricePaid: 10,
      purchasedOn: '2024-02-29',
      fitAdjust: { dx: 0, dy: 1, scale: 1, rotation: 5 },
      colors: [
        { hex: '#112233', share: 0.7, name: 'navy' },
        { hex: '#ffffff', share: 0.3, name: 'white' },
      ],
    };
    const r = validateItem(full);
    expect(r.ok).toBe(true);
    expect(isItem(full)).toBe(true);
    if (r.ok) expect(r.value).toBe(full);
  });

  it('reports every missing required field', () => {
    const r = validateItem({});
    expect(paths(r)).toEqual(
      expect.arrayContaining([
        'id',
        'createdAt',
        'updatedAt',
        'category',
        'subcategory',
        'colors',
        'pattern',
        'patternBold',
        'formality',
        'warmth',
        'rainOk',
        'sporty',
        'status',
        'favorite',
        'images',
        'cutout',
      ]),
    );
  });

  it('rejects bad enums', () => {
    expectBad(validateItem(mutate(item(), { category: 'hat' })), 'category', 'invalid_value');
    expectBad(validateItem(mutate(item(), { category: 3 })), 'category', 'wrong_type');
    expectBad(validateItem(mutate(item(), { pattern: 'plaid' })), 'pattern', 'invalid_value');
    expectBad(validateItem(mutate(item(), { material: 'plastic' })), 'material', 'invalid_value');
    expectBad(validateItem(mutate(item(), { metal: 'tin' })), 'metal', 'invalid_value');
    expectBad(validateItem(mutate(item(), { status: 'gone' })), 'status', 'invalid_value');
  });

  it('rejects a subcategory not listed for the category', () => {
    expectBad(
      validateItem(mutate(item(), { subcategory: 'jeans' })),
      'subcategory',
      'invalid_value',
    );
    expectBad(validateItem(mutate(item(), { subcategory: 7 })), 'subcategory', 'wrong_type');
  });

  it('checks layer', () => {
    expectBad(validateItem(mutate(item(), { layer: 'outer' })), 'layer', 'invalid_value');
    const bottom = mutate(item(), { category: 'bottom', subcategory: 'jeans', layer: 'base' });
    expectBad(validateItem(bottom), 'layer', 'invalid_value');
  });

  it('checks formality and warmth are integers 1-5', () => {
    for (const v of [0, 6, 2.5]) {
      expectBad(validateItem(mutate(item(), { formality: v })), 'formality', 'out_of_range');
      expectBad(validateItem(mutate(item(), { warmth: v })), 'warmth', 'out_of_range');
    }
    expectBad(validateItem(mutate(item(), { formality: '3' })), 'formality', 'wrong_type');
    expectBad(validateItem(mutate(item(), { warmth: NaN })), 'warmth', 'wrong_type');
  });

  it('checks colours', () => {
    const sw = { hex: '#ffffff', share: 1, name: 'white' };
    expectBad(validateItem(mutate(item(), { colors: [] })), 'colors', 'out_of_range');
    expectBad(validateItem(mutate(item(), { colors: [sw, sw, sw, sw] })), 'colors', 'out_of_range');
    expectBad(validateItem(mutate(item(), { colors: 'white' })), 'colors', 'wrong_type');
    expectBad(validateItem(mutate(item(), { colors: [5] })), 'colors.0', 'wrong_type');
    expectBad(
      validateItem(mutate(item(), { colors: [{ ...sw, hex: '#FFFFFF' }] })),
      'colors.0.hex',
      'invalid_format',
    );
    expectBad(
      validateItem(mutate(item(), { colors: [{ ...sw, hex: '#fff' }] })),
      'colors.0.hex',
      'invalid_format',
    );
    expectBad(
      validateItem(mutate(item(), { colors: [{ ...sw, hex: 1 }] })),
      'colors.0.hex',
      'wrong_type',
    );
    expectBad(
      validateItem(mutate(item(), { colors: [{ ...sw, share: 1.5 }] })),
      'colors.0.share',
      'out_of_range',
    );
    expectBad(
      validateItem(mutate(item(), { colors: [{ ...sw, share: -0.1 }] })),
      'colors.0.share',
      'out_of_range',
    );
    expectBad(
      validateItem(mutate(item(), { colors: [{ ...sw, name: 'mauve' }] })),
      'colors.0.name',
      'invalid_value',
    );
    expectBad(
      validateItem(mutate(item(), { colors: [{ hex: '#ffffff', share: 1 }] })),
      'colors.0.name',
      'missing',
    );
  });

  it('checks booleans and strings', () => {
    expectBad(validateItem(mutate(item(), { rainOk: 'yes' })), 'rainOk', 'wrong_type');
    expectBad(validateItem(mutate(item(), { favorite: 1 })), 'favorite', 'wrong_type');
    expectBad(validateItem(mutate(item(), { patternBold: null })), 'patternBold', 'wrong_type');
    expectBad(validateItem(mutate(item(), { name: 5 })), 'name', 'wrong_type');
    expectBad(validateItem(mutate(item(), { brand: 5 })), 'brand', 'wrong_type');
    expectBad(validateItem(mutate(item(), { notes: {} })), 'notes', 'wrong_type');
  });

  it('checks price and purchase date', () => {
    expectBad(validateItem(mutate(item(), { pricePaid: -1 })), 'pricePaid', 'out_of_range');
    expectBad(validateItem(mutate(item(), { pricePaid: '5' })), 'pricePaid', 'wrong_type');
    expectBad(
      validateItem(mutate(item(), { purchasedOn: '2024-02-30' })),
      'purchasedOn',
      'invalid_format',
    );
    expectBad(
      validateItem(mutate(item(), { purchasedOn: '24-02-01' })),
      'purchasedOn',
      'invalid_format',
    );
    expectBad(validateItem(mutate(item(), { purchasedOn: 5 })), 'purchasedOn', 'wrong_type');
  });

  it('accepts a cutout without a crop and a valid crop', () => {
    expect(validateItem(item()).ok).toBe(true);
    const crop = { x: 0, y: 1.5, width: 100, height: 200, scale: 0.5 };
    expect(
      validateItem(mutate(item(), { cutout: { aspectRatio: 1, hasAlpha: true, crop } })).ok,
    ).toBe(true);
  });

  it('checks the optional cutout crop', () => {
    const crop = { x: 0, y: 0, width: 100, height: 200, scale: 0.5 };
    const withCrop = (c: unknown) =>
      validateItem(mutate(item(), { cutout: { aspectRatio: 1, hasAlpha: true, crop: c } }));
    expectBad(withCrop('x'), 'cutout.crop', 'wrong_type');
    expectBad(withCrop({ ...crop, x: undefined }), 'cutout.crop.x', 'missing');
    expectBad(withCrop({ ...crop, y: Number.NaN }), 'cutout.crop.y', 'wrong_type');
    expectBad(withCrop({ ...crop, width: 0 }), 'cutout.crop.width', 'out_of_range');
    expectBad(withCrop({ ...crop, height: -1 }), 'cutout.crop.height', 'out_of_range');
    expectBad(withCrop({ ...crop, scale: 0 }), 'cutout.crop.scale', 'out_of_range');
    expectBad(withCrop({ ...crop, scale: Infinity }), 'cutout.crop.scale', 'wrong_type');
  });

  it('checks images, cutout and fitAdjust', () => {
    expectBad(validateItem(mutate(item(), { images: 'x' })), 'images', 'wrong_type');
    expectBad(
      validateItem(mutate(item(), { images: { originalId: 'o', thumbId: 't' } })),
      'images.cutoutId',
      'missing',
    );
    expectBad(
      validateItem(mutate(item(), { images: { originalId: '', cutoutId: 'c', thumbId: 't' } })),
      'images.originalId',
      'invalid_value',
    );
    expectBad(
      validateItem(mutate(item(), { cutout: { aspectRatio: 0, hasAlpha: true } })),
      'cutout.aspectRatio',
      'out_of_range',
    );
    expectBad(
      validateItem(mutate(item(), { cutout: { aspectRatio: '1', hasAlpha: true } })),
      'cutout.aspectRatio',
      'wrong_type',
    );
    expectBad(
      validateItem(mutate(item(), { cutout: { aspectRatio: 1 } })),
      'cutout.hasAlpha',
      'missing',
    );
    expectBad(
      validateItem(mutate(item(), { fitAdjust: { dx: 0, dy: 0, scale: 0, rotation: 0 } })),
      'fitAdjust.scale',
      'out_of_range',
    );
    expectBad(
      validateItem(mutate(item(), { fitAdjust: { dx: 0, dy: 0, scale: 1 } })),
      'fitAdjust.rotation',
      'missing',
    );
    expectBad(validateItem(mutate(item(), { fitAdjust: 3 })), 'fitAdjust', 'wrong_type');
  });
});

describe('validateOutfit', () => {
  const o = () => newOutfit({ itemIds: ['a', 'b'] }, clock, ids);
  it('accepts valid outfits including optional fields', () => {
    const full = {
      ...o(),
      name: 'n',
      occasion: 'work',
      tucked: true,
      fitOverrides: { a: { dx: 1, dy: 1, scale: 1, rotation: 0 } },
    };
    expect(validateOutfit(full).ok).toBe(true);
    expect(isOutfit(full)).toBe(true);
    expect(isOutfit({})).toBe(false);
    expect(validateOutfit(mutate(o(), { itemIds: [] })).ok).toBe(true);
  });
  it('rejects malformed fields', () => {
    expectBad(validateOutfit(without(o(), 'itemIds')), 'itemIds', 'missing');
    expectBad(validateOutfit(mutate(o(), { itemIds: 'a' })), 'itemIds', 'wrong_type');
    expectBad(validateOutfit(mutate(o(), { itemIds: ['a', 3] })), 'itemIds.1', 'wrong_type');
    expectBad(validateOutfit(mutate(o(), { itemIds: [''] })), 'itemIds.0', 'invalid_value');
    expectBad(validateOutfit(mutate(o(), { itemIds: ['a', 'a'] })), 'itemIds', 'invalid_value');
    expectBad(validateOutfit(mutate(o(), { source: 'ai' })), 'source', 'invalid_value');
    expectBad(validateOutfit(without(o(), 'source')), 'source', 'missing');
    expectBad(validateOutfit(mutate(o(), { occasion: 'party' })), 'occasion', 'invalid_value');
    expectBad(validateOutfit(mutate(o(), { favorite: 'no' })), 'favorite', 'wrong_type');
    expectBad(validateOutfit(mutate(o(), { tucked: 1 })), 'tucked', 'wrong_type');
    expectBad(validateOutfit(mutate(o(), { name: 1 })), 'name', 'wrong_type');
    expectBad(validateOutfit(mutate(o(), { fitOverrides: [] })), 'fitOverrides', 'wrong_type');
    expectBad(
      validateOutfit(mutate(o(), { fitOverrides: { a: 1 } })),
      'fitOverrides.a',
      'wrong_type',
    );
    expectBad(
      validateOutfit(mutate(o(), { fitOverrides: { a: { dx: 1 } } })),
      'fitOverrides.a.dy',
      'missing',
    );
  });
});

describe('validateWearLog', () => {
  const w = () => newWearLog({ date: '2026-01-15', itemIds: ['a'] }, clock, ids);
  it('accepts valid logs including weather and outfitId', () => {
    const full = {
      ...w(),
      outfitId: 'o1',
      note: 'n',
      weather: {
        tempMinC: -2,
        tempMaxC: 5,
        feelsLikeC: -5,
        precipProbability: 0.2,
        windKph: 10,
        isSunny: false,
      },
    };
    expect(validateWearLog(full).ok).toBe(true);
    expect(isWearLog(full)).toBe(true);
    expect(isWearLog(null)).toBe(false);
  });
  it('rejects malformed fields', () => {
    expectBad(validateWearLog(without(w(), 'date')), 'date', 'missing');
    expectBad(validateWearLog(mutate(w(), { date: '2026-02-30' })), 'date', 'invalid_format');
    expectBad(
      validateWearLog(mutate(w(), { date: '2026-01-15T00:00:00Z' })),
      'date',
      'invalid_format',
    );
    expectBad(validateWearLog(mutate(w(), { date: 20260115 })), 'date', 'wrong_type');
    expectBad(validateWearLog(mutate(w(), { itemIds: [1] })), 'itemIds.0', 'wrong_type');
    expectBad(validateWearLog(without(w(), 'planned')), 'planned', 'missing');
    expectBad(validateWearLog(mutate(w(), { planned: 'no' })), 'planned', 'wrong_type');
    expectBad(validateWearLog(mutate(w(), { outfitId: 1 })), 'outfitId', 'wrong_type');
    expectBad(validateWearLog(mutate(w(), { note: 1 })), 'note', 'wrong_type');
    expectBad(validateWearLog(mutate(w(), { weather: 'rain' })), 'weather', 'wrong_type');
    expectBad(validateWearLog(mutate(w(), { weather: {} })), 'weather.tempMinC', 'missing');
    const wx = {
      tempMinC: 1,
      tempMaxC: 2,
      feelsLikeC: 1,
      precipProbability: 0.5,
      windKph: 3,
      isSunny: true,
    };
    expectBad(
      validateWearLog(mutate(w(), { weather: { ...wx, precipProbability: 1.2 } })),
      'weather.precipProbability',
      'out_of_range',
    );
    expectBad(
      validateWearLog(mutate(w(), { weather: { ...wx, windKph: -1 } })),
      'weather.windKph',
      'out_of_range',
    );
    expectBad(
      validateWearLog(mutate(w(), { weather: { ...wx, isSunny: 'y' } })),
      'weather.isSunny',
      'wrong_type',
    );
    expectBad(
      validateWearLog(mutate(w(), { weather: { ...wx, feelsLikeC: '1' } })),
      'weather.feelsLikeC',
      'wrong_type',
    );
  });
});

describe('validateFeedback', () => {
  const f = () => newFeedback({ itemIds: ['b', 'a'], verdict: 'like' }, clock, ids);
  it('accepts valid feedback', () => {
    expect(validateFeedback(f()).ok).toBe(true);
    expect(isFeedback(f())).toBe(true);
    expect(isFeedback({})).toBe(false);
  });
  it('rejects unsorted or duplicate ids and bad verdicts', () => {
    expectBad(validateFeedback(mutate(f(), { itemIds: ['b', 'a'] })), 'itemIds', 'invalid_value');
    expectBad(validateFeedback(mutate(f(), { itemIds: ['a', 'a'] })), 'itemIds', 'invalid_value');
    expectBad(validateFeedback(without(f(), 'itemIds')), 'itemIds', 'missing');
    expectBad(validateFeedback(mutate(f(), { verdict: 'meh' })), 'verdict', 'invalid_value');
    expectBad(validateFeedback(without(f(), 'verdict')), 'verdict', 'missing');
  });
});

describe('validateProfile', () => {
  const p = () => newProfile({}, clock, ids);
  it('accepts valid profiles including location and body photo', () => {
    const full = {
      ...p(),
      displayName: 'A',
      location: { lat: 52.5, lon: 13.4, label: 'Berlin' },
      bodyPhoto: { imageId: 'img', landmarks },
    };
    expect(validateProfile(full).ok).toBe(true);
    expect(isProfile(full)).toBe(true);
    expect(isProfile([])).toBe(false);
  });
  it('accepts the optional lastBackupAt timestamp', () => {
    expect(validateProfile({ ...p(), lastBackupAt: '2026-03-01T09:00:00.000Z' }).ok).toBe(true);
  });
  it('rejects malformed fields', () => {
    expectBad(validateProfile(without(p(), 'bodyTemplateId')), 'bodyTemplateId', 'missing');
    expectBad(
      validateProfile(mutate(p(), { bodyTemplateId: '' })),
      'bodyTemplateId',
      'invalid_value',
    );
    expectBad(validateProfile(mutate(p(), { units: 'metres' })), 'units', 'invalid_value');
    expectBad(validateProfile(without(p(), 'units')), 'units', 'missing');
    expectBad(validateProfile(mutate(p(), { displayName: 3 })), 'displayName', 'wrong_type');
    expectBad(
      validateProfile(mutate(p(), { lastBackupAt: 'yesterday' })),
      'lastBackupAt',
      'invalid_format',
    );
    expectBad(
      validateProfile(mutate(p(), { location: { lat: 91, lon: 0, label: 'x' } })),
      'location.lat',
      'out_of_range',
    );
    expectBad(
      validateProfile(mutate(p(), { location: { lat: 0, lon: -181, label: 'x' } })),
      'location.lon',
      'out_of_range',
    );
    expectBad(
      validateProfile(mutate(p(), { location: { lat: 0, lon: 0 } })),
      'location.label',
      'missing',
    );
    expectBad(validateProfile(mutate(p(), { location: 'Berlin' })), 'location', 'wrong_type');
    expectBad(
      validateProfile(mutate(p(), { bodyPhoto: { landmarks } })),
      'bodyPhoto.imageId',
      'missing',
    );
    expectBad(
      validateProfile(mutate(p(), { bodyPhoto: { imageId: 'i' } })),
      'bodyPhoto.landmarks',
      'missing',
    );
    // Phase 3 photo fields (docs/TRY_ON.md §11): optional, but checked when present.
    expect(
      validateProfile(
        mutate(p(), {
          bodyPhoto: {
            imageId: 'i',
            landmarks,
            detected: landmarks,
            takenAt: '2026-11-18T08:00:00Z',
          },
          tryOnMode: 'photo',
        }),
      ).ok,
    ).toBe(true);
    expectBad(validateProfile(mutate(p(), { tryOnMode: 'mirror' })), 'tryOnMode', 'invalid_value');
    expectBad(
      validateProfile(
        mutate(p(), { bodyPhoto: { imageId: 'i', landmarks, takenAt: 'yesterday' } }),
      ),
      'bodyPhoto.takenAt',
      'invalid_format',
    );
    expectBad(
      validateProfile(
        mutate(p(), { bodyPhoto: { imageId: 'i', landmarks: { ...landmarks, chin: 5 } } }),
      ),
      'bodyPhoto.landmarks.chin',
      'wrong_type',
    );
    expectBad(
      validateProfile(
        mutate(p(), { bodyPhoto: { imageId: 'i', landmarks: without(landmarks, 'footR') } }),
      ),
      'bodyPhoto.landmarks.footR',
      'missing',
    );
    expectBad(
      validateProfile(
        mutate(p(), { bodyPhoto: { imageId: 'i', landmarks: { ...landmarks, chin: { x: 1 } } } }),
      ),
      'bodyPhoto.landmarks.chin.y',
      'missing',
    );
  });
});
