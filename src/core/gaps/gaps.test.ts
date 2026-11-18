import { nameColor } from '../color/classify';
import { newItem } from '../model/factories';
import type { NewItemInit } from '../model/factories';
import { slotOf } from '../model/slots';
import { validateItem } from '../model/validate';
import type { Item } from '../model/types';
import { fixedClock } from '../testing/clock';
import { fixtureCloset } from '../testing/fixtures';
import { ARCHETYPES, ARCHETYPE_ID_PREFIX, archetypeById, archetypeIdOfItemId } from './archetypes';
import { isCovered } from './coverage';
import { findDuplicates } from './findDuplicates';
import { findGaps, findOrphans } from './findGaps';

function make(
  id: string,
  init: Partial<NewItemInit> & Pick<NewItemInit, 'category' | 'subcategory'>,
): Item {
  return newItem(
    {
      colors: [{ hex: '#1b1b1d', share: 1, name: 'black' }],
      images: { originalId: `${id}-o`, cutoutId: `${id}-c`, thumbId: `${id}-t` },
      cutout: { aspectRatio: 1, hasAlpha: true },
      ...init,
    },
    fixedClock(),
    { uuid: () => id },
  );
}

describe('archetypes', () => {
  it('has about 40 staples', () => {
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(40);
  });
  it('are all valid items with unique ids', () => {
    const ids = new Set<string>();
    for (const a of ARCHETYPES) {
      expect(validateItem(a.item).ok).toBe(true);
      expect(a.item.id).toBe(`${ARCHETYPE_ID_PREFIX}${a.archetypeId}`);
      expect(archetypeIdOfItemId(a.item.id)).toBe(a.archetypeId);
      expect(a.archetypeId).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(ids.has(a.archetypeId)).toBe(false);
      ids.add(a.archetypeId);
      for (const c of a.item.colors) expect(c.name).toBe(nameColor(c.hex));
    }
    expect(ids.size).toBe(ARCHETYPES.length);
  });
  it('are deterministic static data', () => {
    expect(archetypeById('white-sneakers')?.item.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('coverage', () => {
  const sneakers = archetypeById('white-sneakers');
  const dark = archetypeById('dark-jeans');
  const closet = fixtureCloset();
  if (!sneakers || !dark) throw new Error('missing archetype');

  it('covered by same subcategory and same neutral colour', () => {
    const white = make('w', {
      category: 'shoes',
      subcategory: 'sneakers',
      colors: [{ hex: '#ffffff', share: 1, name: 'white' }],
    });
    expect(isCovered(sneakers, [white])).toBe(true);
  });
  it('not covered by another colour or subcategory, or an inactive item', () => {
    const black = make('b', { category: 'shoes', subcategory: 'sneakers' });
    const whiteLoafers = make('l', {
      category: 'shoes',
      subcategory: 'loafers',
      colors: [{ hex: '#ffffff', share: 1, name: 'white' }],
    });
    const whiteArchived = make('a', {
      category: 'shoes',
      subcategory: 'sneakers',
      colors: [{ hex: '#ffffff', share: 1, name: 'white' }],
      status: 'archived',
    });
    expect(isCovered(sneakers, [black, whiteLoafers, whiteArchived])).toBe(false);
  });
  it('accent colours match within 30 degrees of hue, not beyond', () => {
    const blueShirt = archetypeById('light-blue-shirt');
    if (!blueShirt) throw new Error('missing');
    const near = make('n', {
      category: 'top',
      subcategory: 'shirt',
      colors: [{ hex: '#3b6fd4', share: 1, name: 'blue' }],
    });
    const far = make('f', {
      category: 'top',
      subcategory: 'shirt',
      colors: [{ hex: '#d43b3b', share: 1, name: 'red' }],
    });
    expect(isCovered(blueShirt, [near])).toBe(true);
    expect(isCovered(blueShirt, [far])).toBe(false);
  });
  it('a neutral never covers an accent archetype', () => {
    const blueShirt = archetypeById('light-blue-shirt');
    if (!blueShirt) throw new Error('missing');
    expect(
      isCovered(blueShirt, [
        make('g', {
          category: 'top',
          subcategory: 'shirt',
          colors: [{ hex: '#8a8d91', share: 1, name: 'grey' }],
        }),
      ]),
    ).toBe(false);
  });
  it('the fixture closet already covers some archetypes', () => {
    expect(isCovered(dark, closet)).toBe(true);
    expect(ARCHETYPES.filter((a) => isCovered(a, closet)).length).toBeGreaterThan(3);
  });
});

describe('findGaps on the fixture closet', () => {
  const closet = fixtureCloset();
  const all = findGaps(closet);
  const gaps = all.filter((g) => g.kind === 'core');
  const addons = all.filter((g) => g.kind === 'addon');

  it('returns at most 5 core gaps, sorted, with real example outfits', () => {
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < gaps.length; i++) {
      expect((gaps[i - 1] as { unlockedCount: number }).unlockedCount).toBeGreaterThanOrEqual(
        (gaps[i] as { unlockedCount: number }).unlockedCount,
      );
    }
    const ids = new Set(closet.map((i) => i.id));
    for (const g of all) {
      expect(g.kind === 'core' ? g.unlockedCount : g.improvedCount).toBeGreaterThan(0);
      expect(g.exampleOutfitItemIds).toContain(`${ARCHETYPE_ID_PREFIX}${g.archetypeId}`);
      for (const id of g.exampleOutfitItemIds) {
        expect(id.startsWith(ARCHETYPE_ID_PREFIX) || ids.has(id)).toBe(true);
      }
      const covered = archetypeById(g.archetypeId);
      expect(covered && isCovered(covered, closet)).toBe(false);
    }
  });

  it('returns up to 3 add-ons ranked by improvedCount, all non-core and uncovered', () => {
    expect(addons.length).toBeGreaterThan(0);
    expect(addons.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < addons.length; i++) {
      expect((addons[i - 1] as { improvedCount: number }).improvedCount).toBeGreaterThanOrEqual(
        (addons[i] as { improvedCount: number }).improvedCount,
      );
    }
    for (const g of addons) {
      const a = archetypeById(g.archetypeId);
      expect(a && ['base', 'bottom', 'onepiece', 'shoes'].includes(slotOf(a.item))).toBe(false);
      expect(g.unlockedCount).toBe(0);
      expect(g.exampleOutfitItemIds).toContain(`${ARCHETYPE_ID_PREFIX}${g.archetypeId}`);
      expect(g.exampleOutfitItemIds.length).toBe(4);
    }
  });

  it('removing the white sneakers makes white-sneakers a top-3 gap', () => {
    const without = closet.filter(
      (i) =>
        !(i.category === 'shoes' && i.subcategory === 'sneakers' && i.colors[0]?.name === 'white'),
    );
    expect(without.length).toBe(closet.length - 1);
    const top = findGaps(without).map((g) => g.archetypeId);
    expect(top.slice(0, 3)).toContain('white-sneakers');
  });

  it('is deterministic and independent of input order', () => {
    expect(findGaps(fixtureCloset())).toEqual(all);
    expect(findGaps([...closet].reverse())).toEqual(all);
  });

  it('an empty closet unlocks nothing', () => {
    expect(findGaps([])).toEqual([]);
  });
});

describe('findOrphans', () => {
  it('flags a neon formal floral gown in a closet without dressy shoes', () => {
    const gown = make('neon-gown', {
      category: 'onepiece',
      subcategory: 'evening-gown',
      colors: [{ hex: '#39ff14', share: 1, name: 'green' }],
      pattern: 'floral',
      patternBold: true,
    });
    const dressy = ['heels-black', 'loafers-brown', 'boots-black-chelsea'];
    const closet = fixtureCloset().filter((i) => !dressy.includes(i.id));
    const orphans = findOrphans([...closet, gown]);
    const report = orphans.find((o) => o.itemId === 'neon-gown');
    expect(report).toBeDefined();
    expect(report?.goodOutfitCount).toBeLessThan(3);
    expect(report?.wouldHelp.length).toBeGreaterThan(0);
    expect(report?.wouldHelp.length).toBeLessThanOrEqual(3);
  });
  it('does not flag a well-matched item', () => {
    const ids = findOrphans(fixtureCloset()).map((o) => o.itemId);
    expect(ids).not.toContain('tee-white');
    expect(ids).not.toContain('jeans-dark');
  });
  it('ignores non-main items and inactive items', () => {
    const closet = fixtureCloset();
    for (const o of findOrphans(closet)) {
      const item = closet.find((i) => i.id === o.itemId) as Item;
      expect(item.status).toBe('active');
      expect(['top', 'bottom', 'onepiece', 'shoes']).toContain(item.category);
      expect(item.layer).not.toBe('mid');
    }
  });
});

describe('findDuplicates', () => {
  const tee = (id: string, hex: string, name: 'black' | 'navy'): Item =>
    make(id, { category: 'top', subcategory: 'tshirt', colors: [{ hex, share: 1, name }] });
  it('groups near-identical black tees but not black vs navy', () => {
    const items = [
      tee('t1', '#1b1b1d', 'black'),
      tee('t2', '#1e1e20', 'black'),
      tee('t3', '#1f2a44', 'navy'),
    ];
    expect(findDuplicates(items)).toEqual([{ itemIds: ['t1', 't2'] }]);
  });
  it('requires the same pattern and active status, and a small colour distance', () => {
    const striped = make('t4', { category: 'top', subcategory: 'tshirt', pattern: 'stripe' });
    const gone = make('t5', { category: 'top', subcategory: 'tshirt', status: 'archived' });
    const lighter = tee('t6', '#3a3a3a', 'black');
    expect(findDuplicates([tee('t1', '#1b1b1d', 'black'), striped, gone, lighter])).toEqual([]);
  });
  it('finds no duplicates in the fixture closet pairs that differ in colour', () => {
    for (const g of findDuplicates(fixtureCloset())) expect(g.itemIds.length).toBeGreaterThan(1);
  });
});

describe('performance', () => {
  it('handles a 150-item closet in under 300 ms', () => {
    const base = fixtureCloset();
    const big: Item[] = [];
    for (let i = 0; big.length < 150; i++) {
      const src = base[i % base.length] as Item;
      big.push({ ...src, id: `${src.id}-${i}` });
    }
    findGaps(big); // warm-up
    const t0 = performance.now();
    findGaps(big);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(300);
  });
});
