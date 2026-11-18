import { outfit, tweak } from '../testUtils';
import { scoreCoordination } from './coordination';

describe('scoreCoordination (§4.4)', () => {
  it('is null when no check applies', () => {
    expect(scoreCoordination(outfit('tee-white', 'jeans-dark', 'sneakers-white'))).toBeNull();
  });

  describe('leathers', () => {
    it('black belt + black leather shoes → 1.0', () => {
      const r = scoreCoordination(outfit('belt-black-leather', 'boots-black-chelsea'));
      expect(r?.value).toBe(1);
      expect(r?.reasons).toContainEqual({ code: 'LEATHERS_MATCH', params: { colour: 'black' } });
    });
    it('black belt + suede black heels → 1.0 (suede counts)', () => {
      expect(scoreCoordination(outfit('belt-black-leather', 'heels-black'))?.value).toBe(1);
    });
    it('brown belt + brown loafers → 1.0', () => {
      expect(scoreCoordination(outfit('belt-brown-leather', 'loafers-brown'))?.value).toBe(1);
    });
    it('brown belt + tan sandals → 1.0 (brown/tan family)', () => {
      expect(scoreCoordination(outfit('belt-brown-leather', 'sandals-tan'))?.value).toBe(1);
    });
    it('black belt + brown shoes → 0.3', () => {
      const r = scoreCoordination(outfit('belt-black-leather', 'loafers-brown'));
      expect(r?.value).toBe(0.3);
      expect(r?.reasons.some((x) => x.code === 'LEATHERS_MATCH')).toBe(false);
    });
    it('does not apply when shoes are not leather', () => {
      expect(scoreCoordination(outfit('belt-black-leather', 'running-shoes-grey'))).toBeNull();
    });
  });

  describe('metals', () => {
    it('shared metal → 1.0', () => {
      const r = scoreCoordination(outfit('necklace-gold', 'belt-brown-leather'));
      expect(r?.value).toBe(1);
      expect(r?.reasons).toContainEqual({ code: 'METALS_MATCH', params: { metal: 'gold' } });
    });
    it('mixed metals → 0.5', () => {
      expect(scoreCoordination(outfit('necklace-gold', 'watch-silver'))?.value).toBe(0.5);
    });
    it('a single metal item does not count', () => {
      expect(scoreCoordination(outfit('necklace-gold', 'tee-white'))).toBeNull();
    });
  });

  describe('bag', () => {
    it('neutral bag → 1.0', () => {
      expect(scoreCoordination(outfit('bag-shoulder-brown', 'sneakers-white'))?.value).toBe(1);
    });
    it('accent bag matching shoes → 1.0', () => {
      const bag = tweak('bag-shoulder-brown', {
        colors: [{ hex: '#b3262e', share: 1, name: 'red' }],
        metal: undefined,
      });
      const shoes = tweak('sneakers-white', {
        colors: [{ hex: '#c0303a', share: 1, name: 'red' }],
      });
      expect(scoreCoordination([bag, shoes])?.value).toBe(1);
    });
    it('accent bag not matching shoes or belt → 0.6', () => {
      const bag = tweak('bag-shoulder-brown', {
        colors: [{ hex: '#b3262e', share: 1, name: 'red' }],
        metal: undefined,
      });
      expect(scoreCoordination([bag, ...outfit('heels-black')])?.value).toBe(0.6);
    });
  });

  it('averages the applicable checks', () => {
    // leathers clash (0.3) + metals match gold/gold (1.0) + neutral bag (1.0)
    const r = scoreCoordination(outfit('belt-brown-leather', 'heels-black', 'bag-shoulder-brown'));
    expect(r?.value).toBeCloseTo((0.3 + 1 + 1) / 3, 10);
  });
});
