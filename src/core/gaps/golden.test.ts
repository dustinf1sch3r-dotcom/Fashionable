import type { Item } from '../model/types';
import { fixtureCloset } from '../testing/fixtures';
import { findGaps, findOrphans } from './findGaps';
import { syntheticCloset } from './syntheticCloset';

function duplicated(n: number): Item[] {
  const base = fixtureCloset();
  const big: Item[] = [];
  for (let i = 0; big.length < n; i++) {
    const src = base[i % base.length] as Item;
    big.push({ ...src, id: `${src.id}-${i}` });
  }
  return big;
}

/** Output captured before the gaps speed-up; results must stay byte-identical. */
describe('gaps golden output', () => {
  const closets: [string, Item[]][] = [
    ['fixture', fixtureCloset()],
    ['duplicated-150', duplicated(150)],
    ['synthetic-150-seed7', syntheticCloset(150, 7)],
    ['synthetic-60-seed3', syntheticCloset(60, 3)],
  ];
  it.each(closets)('findGaps %s', (_n, items) => {
    expect(findGaps(items)).toMatchSnapshot();
    expect(findGaps(items, { seed: 99 })).toMatchSnapshot();
  });
  it.each(closets)('findOrphans %s', (_n, items) => {
    expect(findOrphans(items)).toMatchSnapshot();
    expect(findOrphans(items, { seed: 99 })).toMatchSnapshot();
  });
});
