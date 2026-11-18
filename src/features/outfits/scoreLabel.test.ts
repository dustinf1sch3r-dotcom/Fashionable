import { SCORE_BANDS, SCORE_FALLBACK_LABEL, scoreLabel } from './scoreLabel';

describe('scoreLabel', () => {
  it('maps the band edges', () => {
    expect(scoreLabel(100)).toBe('Great match');
    expect(scoreLabel(90)).toBe('Great match');
    expect(scoreLabel(89.9)).toBe('Good match');
    expect(scoreLabel(85)).toBe('Good match');
    expect(scoreLabel(84.9)).toBe(SCORE_FALLBACK_LABEL);
    expect(scoreLabel(0)).toBe(SCORE_FALLBACK_LABEL);
  });

  it('lists bands from best to worst', () => {
    const mins = SCORE_BANDS.map((b) => b.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });
});
