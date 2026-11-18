import { archetypeById } from '@/core/gaps';
import { categoryOutline, garmentArtUri, withArtAspect } from './archetypeArt';

const sneakers = archetypeById('white-sneakers')?.item;
const jeans = archetypeById('dark-jeans')?.item;
if (!sneakers || !jeans) throw new Error('missing archetype');

describe('archetype art', () => {
  it('draws the item colour', () => {
    expect(garmentArtUri(jeans)).toContain(`fill="${jeans.colors[0]?.hex}"`);
  });
  it('marks suggestions with a dashed outline', () => {
    expect(garmentArtUri(jeans)).not.toContain('stroke-dasharray');
    expect(garmentArtUri(jeans, { suggested: true })).toContain('stroke-dasharray');
  });
  it('uses a shape that matches the kind of garment', () => {
    expect(garmentArtUri(sneakers)).not.toBe(garmentArtUri(jeans));
    expect(withArtAspect(sneakers).cutout.aspectRatio).toBeGreaterThan(1);
    expect(withArtAspect(jeans).cutout.aspectRatio).toBeLessThan(1);
  });
  it('draws shoes as a pair of side profiles: two outlines, each with a sole-line slot', () => {
    const { path, aspect } = categoryOutline('shoes');
    expect(aspect).toBe(1.6);
    // Two shoes, each an outline plus a sole slot: four closed sub-paths.
    expect(path.match(/Z/g)).toHaveLength(4);
    expect(path.match(/M/g)).toHaveLength(4);
    expect(garmentArtUri(sneakers)).toContain(path);
  });
});
