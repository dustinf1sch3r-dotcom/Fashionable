import { archetypeById } from '@/core/gaps';
import { garmentArtUri, withArtAspect } from './archetypeArt';

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
});
