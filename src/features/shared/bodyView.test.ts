import { BODY_A } from '@/core/tryon/bodies';
import type { BodyLandmarks } from '@/core/model/types';
import { resolveBodyView } from './bodyView';

const MINE: BodyLandmarks = {
  ...BODY_A.landmarks,
  shoulderL: { x: 300, y: 420 },
  shoulderR: { x: 700, y: 420 },
};
const profile = (extra: object = {}) => ({
  bodyTemplateId: 'body-a',
  bodyPhoto: { imageId: 'me', landmarks: MINE },
  ...extra,
});

describe('resolveBodyView', () => {
  it('uses the silhouette when there is no profile or no photo', () => {
    expect(resolveBodyView(null, undefined)).toEqual({
      body: BODY_A,
      mode: 'silhouette',
      hasPhoto: false,
    });
    expect(resolveBodyView({ bodyTemplateId: 'body-a' }, 'blob:x')).toMatchObject({
      mode: 'silhouette',
      hasPhoto: false,
    });
  });

  it('defaults to the photo once one exists', () => {
    const v = resolveBodyView(profile(), 'blob:me');
    expect(v).toEqual({
      body: { id: 'photo', landmarks: MINE },
      backdrop: 'blob:me',
      mode: 'photo',
      hasPhoto: true,
    });
  });

  it('honours the silhouette mode and keeps the toggle available', () => {
    const v = resolveBodyView(profile({ tryOnMode: 'silhouette' }), 'blob:me');
    expect(v.body).toBe(BODY_A);
    expect(v.backdrop).toBeUndefined();
    expect(v).toMatchObject({ mode: 'silhouette', hasPhoto: true });
  });

  it('uses the photo landmarks without a backdrop while the image is loading', () => {
    const v = resolveBodyView(profile(), undefined);
    expect(v.body.landmarks).toBe(MINE);
    expect(v.backdrop).toBeUndefined();
    expect(v).toMatchObject({ mode: 'photo', hasPhoto: true });
  });

  it('falls back to the silhouette and hides the toggle when the image is missing', () => {
    const v = resolveBodyView(profile({ tryOnMode: 'photo' }), null);
    expect(v).toEqual({ body: BODY_A, mode: 'silhouette', hasPhoto: false });
  });

  it('falls back to body-a for an unknown template id', () => {
    expect(resolveBodyView({ bodyTemplateId: 'nope' }, undefined).body).toBe(BODY_A);
  });
});
