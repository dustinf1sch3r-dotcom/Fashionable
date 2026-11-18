import { createRng } from '../engine/rng';
import { scoreOutfit } from '../engine/scoreOutfit';
import { buildTasteModel } from '../engine/taste';
import type { ScoreContext, ScoreHistory } from '../engine/scoreOutfit';
import type { Item } from '../model/types';
import { fixtureCloset } from '../testing/fixtures';
import { ARCHETYPES } from './archetypes';
import { fastTotal, prepItem } from './fastScore';
import { GAP_SCORE_DATE } from './weights';
import { syntheticCloset } from './syntheticCloset';

const CONTEXT: ScoreContext = { date: GAP_SCORE_DATE, occasion: 'any' };
const HISTORY: ScoreHistory = { wearLogs: [], taste: buildTasteModel([], []) };

describe('fastTotal equals scoreOutfit (occasion any, no weather, no history)', () => {
  const pools: [string, Item[]][] = [
    ['fixtures', fixtureCloset()],
    ['synthetic', syntheticCloset(200, 11)],
    ['archetypes', ARCHETYPES.map((a) => a.item)],
    ['mixed', [...syntheticCloset(80, 5), ...ARCHETYPES.map((a) => a.item)]],
  ];

  it.each(pools)('random outfits of 0-6 items from %s', (_name, items) => {
    const rng = createRng(2024);
    const preps = new Map(items.map((i) => [i, prepItem(i)]));
    for (let n = 0; n < 4000; n++) {
      const size = rng.int(0, 6);
      const list = Array.from({ length: size }, () => rng.pick(items));
      const expected = scoreOutfit(list, CONTEXT, HISTORY).total;
      const actual = fastTotal(list.map((i) => preps.get(i) as ReturnType<typeof prepItem>));
      expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
    }
  });

  it('matches for core combos plus one add-on archetype', () => {
    const closet = syntheticCloset(150, 7);
    const rng = createRng(99);
    for (let n = 0; n < 3000; n++) {
      const combo = [rng.pick(closet), rng.pick(closet), rng.pick(closet)];
      const addon = rng.pick(ARCHETYPES).item;
      const list = [...combo, addon];
      expect(
        Math.abs(fastTotal(list.map(prepItem)) - scoreOutfit(list, CONTEXT, HISTORY).total),
      ).toBeLessThan(1e-9);
    }
  });
});
