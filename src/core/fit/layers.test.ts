import type { Point } from '../model/types';
import { layeredTargets, type LayerInput } from './layers';
import { nestInside } from './nest';
import { rigTargets } from './targets';
import { bodyA, detected } from './testHelpers';

const input = (itemId: string, name: Parameters<typeof detected>[0], slot: LayerInput['slot']) => {
  const d = detected(name);
  return { itemId, rig: d.rig, aspect: d.aspect, slot };
};

describe('layeredTargets', () => {
  it('nests mid inside outer and base inside mid, outermost first', () => {
    const coat = input('coat', 'coat', 'outer');
    const sweater = input('sweater', 'longSleeve', 'mid');
    const tee = input('tee', 'tee', 'base');
    const jeans = input('jeans', 'jeans', 'bottom');
    const out = layeredTargets([tee, jeans, sweater, coat], bodyA);

    const own = (l: LayerInput) => rigTargets(l.rig, l.aspect, bodyA, l.slot);
    expect(out.coat.targets).toEqual(own(coat));
    expect(out.coat.nestedIn).toEqual([]);
    const nestedSweater = nestInside(own(sweater), own(coat), bodyA);
    expect(out.sweater).toEqual({ targets: nestedSweater, nestedIn: ['coat'] });
    expect(out.tee).toEqual({
      targets: nestInside(own(tee), nestedSweater, bodyA),
      nestedIn: ['coat', 'sweater'],
    });
    expect(out.jeans).toEqual({ targets: own(jeans), nestedIn: [] });
  });

  it('nests the base top straight inside the outer layer when there is no mid layer', () => {
    const coat = input('coat', 'coat', 'outer');
    const shirt = input('shirt', 'longSleeve', 'base');
    const out = layeredTargets([shirt, coat], bodyA);
    expect(out.shirt.nestedIn).toEqual(['coat']);
    const sx = (p: Record<string, Point>, k: string) => (p[k] as Point).x;
    expect(sx(out.shirt.targets, 'cuffOuterL')).toBeGreaterThanOrEqual(
      sx(out.coat.targets, 'cuffOuterL'),
    );
  });

  it('leaves a single garment untouched', () => {
    const tee = input('tee', 'tee', 'base');
    expect(layeredTargets([tee], bodyA).tee).toEqual({
      targets: rigTargets(tee.rig, tee.aspect, bodyA, 'base'),
      nestedIn: [],
    });
  });
});
