import { UNAVAILABLE_TEXT, errorText } from './messages';

describe('errorText', () => {
  it('words each error', () => {
    expect(errorText('weather-unavailable')).toBe(UNAVAILABLE_TEXT);
    expect(errorText('location-denied')).toMatch(/denied/);
    expect(errorText('location-unavailable')).toMatch(/position/);
    expect(errorText(null)).toBeUndefined();
  });
});
