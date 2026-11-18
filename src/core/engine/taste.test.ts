import { newFeedback } from '../model/factories';
import type { Feedback, Item } from '../model/types';
import { fixedClock } from '../testing/clock';
import { fixtureCloset, fixtureFeedback, WEATHER_MILD } from '../testing/fixtures';
import { sequentialIds } from '../testing/ids';
import { scoreOutfit } from './scoreOutfit';
import { buildTasteModel, colourFamily, isDislikedSet, scoreTaste } from './taste';
import { outfit, tweak } from './testUtils';

const CLOSET = fixtureCloset();
const GOOD = outfit('tee-white', 'jeans-dark', 'sneakers-white');
const ids = sequentialIds('t');

function fb(itemIds: string[], verdict: Feedback['verdict'], at = '2026-01-10T20:00:00.000Z') {
  return newFeedback({ itemIds, verdict }, fixedClock(at), ids);
}

describe('taste', () => {
  it('is null with no feedback', () => {
    expect(scoreTaste(GOOD, buildTasteModel([], CLOSET))).toBeNull();
  });

  it('is null for an outfit with fewer than two items', () => {
    const m = buildTasteModel([fb(['tee-white', 'jeans-dark'], 'like')], CLOSET);
    expect(scoreTaste(outfit('tee-white'), m)).toBeNull();
  });

  it('a liked set scores above 0.5 with TASTE_MATCH; a disliked set below, without', () => {
    const liked = buildTasteModel(
      [
        fb(
          GOOD.map((i) => i.id),
          'like',
        ),
      ],
      CLOSET,
    );
    const r = scoreTaste(GOOD, liked);
    expect(r?.value).toBeGreaterThan(0.6);
    expect(r?.reasons.map((x) => x.code)).toEqual(['TASTE_MATCH']);
    const disliked = buildTasteModel(
      [
        fb(
          GOOD.map((i) => i.id),
          'dislike',
        ),
      ],
      CLOSET,
    );
    const d = scoreTaste(GOOD, disliked);
    expect(d?.value).toBeLessThan(0.5);
    expect(d?.reasons).toEqual([]);
  });

  it('generalises through attributes to unrated items', () => {
    const m = buildTasteModel([fb(['tee-navy', 'chinos-beige'], 'like')], CLOSET);
    const navyTop2 = tweak('tee-navy', { id: 'navy-top-2' });
    const beigeBottom2 = tweak('chinos-beige', { id: 'beige-bottom-2' });
    const r = scoreTaste([navyTop2, beigeBottom2], m);
    expect(r?.value).toBeGreaterThan(0.5);
    // a different colour pairing gets no attribute boost
    const other = scoreTaste(outfit('tee-white', 'jeans-dark'), m);
    expect(other?.value).toBe(0.5);
    const dm = buildTasteModel([fb(['tee-navy', 'chinos-beige'], 'dislike')], CLOSET);
    expect(scoreTaste([navyTop2, beigeBottom2], dm)?.value).toBeLessThan(0.5);
  });

  it('latest verdict on the same set wins, whatever the array order', () => {
    const older = fb(['tee-white', 'jeans-dark'], 'like', '2026-01-01T00:00:00.000Z');
    const newer = fb(['jeans-dark', 'tee-white'], 'dislike', '2026-01-02T00:00:00.000Z');
    for (const list of [
      [older, newer],
      [newer, older],
    ]) {
      const m = buildTasteModel(list, CLOSET);
      expect(isDislikedSet(['tee-white', 'jeans-dark'], m)).toBe(true);
      expect(scoreTaste(outfit('tee-white', 'jeans-dark'), m)?.value).toBeLessThan(0.5);
    }
    const back = fb(['tee-white', 'jeans-dark'], 'like', '2026-01-03T00:00:00.000Z');
    expect(
      isDislikedSet(['tee-white', 'jeans-dark'], buildTasteModel([older, newer, back], CLOSET)),
    ).toBe(false);
  });

  it('ignores soft-deleted feedback', () => {
    const f = {
      ...fb(['tee-white', 'jeans-dark'], 'dislike'),
      deletedAt: '2026-01-11T00:00:00.000Z',
    };
    const m = buildTasteModel([f], CLOSET);
    expect(m.feedbackCount).toBe(0);
    expect(isDislikedSet(['tee-white', 'jeans-dark'], m)).toBe(false);
  });

  it('isDislikedSet matches the exact set only, in any order', () => {
    const m = buildTasteModel(fixtureFeedback(), CLOSET);
    expect(isDislikedSet(['jeans-light', 'blouse-floral', 'sweater-red'], m)).toBe(true);
    expect(isDislikedSet(['blouse-floral', 'sweater-red'], m)).toBe(false);
    expect(
      isDislikedSet(['blouse-floral', 'sweater-red', 'jeans-light', 'belt-brown-leather'], m),
    ).toBe(false);
    expect(isDislikedSet(['tee-white', 'jeans-dark', 'sneakers-white'], m)).toBe(false); // liked
  });

  it('colourFamily: neutral names, denim, 30-degree hue buckets', () => {
    const by = (id: string): Item => CLOSET.find((i) => i.id === id) as Item;
    expect(colourFamily(by('tee-navy'))).toBe('navy');
    expect(colourFamily(by('chinos-beige'))).toBe('beige');
    expect(colourFamily(by('jeans-dark'))).toBe('denim');
    expect(colourFamily(by('sweater-red'))).toBe('hue330');
    expect(colourFamily({ ...by('tee-navy'), colors: [] })).toBe('none');
  });

  it('is deterministic', () => {
    const run = () => scoreTaste(GOOD, buildTasteModel(fixtureFeedback(), CLOSET));
    expect(run()).toEqual(run());
  });
});

describe('scoreOutfit with taste', () => {
  const ctx = { date: '2026-01-10', occasion: 'casual' as const, weather: WEATHER_MILD };
  const feedback = [
    fb(
      GOOD.map((i) => i.id),
      'like',
    ),
  ];

  it('unchanged without feedback; changes with it', () => {
    const none = scoreOutfit(GOOD, ctx, { wearLogs: [] });
    const empty = scoreOutfit(GOOD, ctx, { wearLogs: [], feedback: [] });
    expect(empty).toEqual(none);
    expect(none.components.taste).toBeUndefined();
    const liked = scoreOutfit(GOOD, ctx, { wearLogs: [], feedback });
    expect(liked.components.taste?.value).toBeGreaterThan(0.6);
    expect(liked.total).not.toBe(none.total);
    const disliked = scoreOutfit(GOOD, ctx, {
      wearLogs: [],
      feedback: [
        fb(
          GOOD.map((i) => i.id),
          'dislike',
        ),
      ],
    });
    expect(disliked.total).toBeLessThan(liked.total);
  });

  it('a prebuilt history.taste takes precedence over feedback', () => {
    const taste = buildTasteModel(
      [
        fb(
          GOOD.map((i) => i.id),
          'dislike',
        ),
      ],
      CLOSET,
    );
    const b = scoreOutfit(GOOD, ctx, { wearLogs: [], feedback, taste });
    expect(b.components.taste?.value).toBeLessThan(0.5);
  });
});
