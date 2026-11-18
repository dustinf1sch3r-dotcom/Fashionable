import { missingSlotsPhrase, tooSmallText } from './missingSlots';

describe('missingSlotsPhrase', () => {
  it('names one or several slots in a natural order', () => {
    expect(missingSlotsPhrase(['shoes'])).toBe('some shoes');
    expect(missingSlotsPhrase(['shoes', 'base'])).toBe('a top and some shoes');
    expect(missingSlotsPhrase(['shoes', 'bottom', 'base'])).toBe(
      'a top, trousers or a skirt and some shoes',
    );
    expect(missingSlotsPhrase(['onepiece'])).toBe('a dress');
  });

  it('never returns an empty phrase', () => {
    expect(missingSlotsPhrase([])).toBe('a few more pieces');
  });
});

describe('tooSmallText', () => {
  it('says what to add', () => {
    const t = tooSmallText(['shoes', 'base'], 'any');
    expect(t.body).toBe('Add a top and some shoes to get outfit ideas.');
  });

  it('mentions the occasion when one is chosen', () => {
    const t = tooSmallText(['shoes'], 'formal');
    expect(t.title).toContain('formal');
    expect(t.body).toContain('some shoes');
    expect(t.body).toContain('another occasion');
  });
});
