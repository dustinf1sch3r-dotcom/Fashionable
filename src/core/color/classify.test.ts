import { deltaE, hueFamilies, isNeutral, meanHue, nameColor, rgbToLab } from './classify';

describe('nameColor', () => {
  it.each([
    ['#1f2a44', 'navy'],
    ['#c8b08a', 'beige'],
    ['#6b4a2b', 'brown'],
    ['#5a5f3a', 'olive'],
    ['#000000', 'black'],
    ['#ffffff', 'white'],
    ['#808080', 'grey'],
    ['#8a8d90', 'grey'],
    ['#ff0000', 'red'],
    ['#00ff00', 'green'],
    ['#0000ff', 'blue'],
    ['#ffff00', 'yellow'],
    ['#ff8000', 'orange'],
    ['#008080', 'teal'],
    ['#800080', 'purple'],
    ['#ff69b4', 'pink'],
    ['#f5f5dc', 'beige'],
  ] as const)('%s -> %s', (hex, name) => {
    expect(nameColor(hex)).toBe(name);
  });
});

describe('isNeutral', () => {
  it('treats neutral names as neutral and others as accents', () => {
    expect(isNeutral('#1f2a44')).toBe(true);
    expect(isNeutral('#c8b08a')).toBe(true);
    expect(isNeutral('#ff0000')).toBe(false);
    expect(isNeutral({ hex: '#ff0000', name: 'red' })).toBe(false);
    expect(isNeutral({ hex: '#808080', name: 'grey' })).toBe(true);
  });

  it('counts denim as neutral whatever the hue', () => {
    expect(isNeutral('#2255cc', 'denim')).toBe(true);
    expect(isNeutral('#2255cc', 'cotton')).toBe(false);
  });
});

describe('hueFamilies', () => {
  it('groups hues within 30 degrees, including across the 0/360 wrap', () => {
    const fams = hueFamilies([{ h: 350 }, { h: 120 }, { h: 15 }, { h: 140 }]);
    expect(fams).toHaveLength(2);
    expect(fams[0].map((a) => a.h)).toEqual([350, 15]);
    expect(fams[1].map((a) => a.h)).toEqual([120, 140]);
  });

  it('splits hues just over 30 degrees apart and handles empty input', () => {
    expect(hueFamilies([{ h: 0 }, { h: 31 }])).toHaveLength(2);
    expect(hueFamilies([{ h: 0 }, { h: 30 }])).toHaveLength(1);
    expect(hueFamilies([])).toEqual([]);
  });

  it('meanHue is circular', () => {
    expect(meanHue([350, 10])).toBeCloseTo(0, 5);
  });
});

describe('Lab and deltaE', () => {
  it('maps black and white to L 0 and 100', () => {
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 3);
    expect(rgbToLab({ r: 255, g: 255, b: 255 }).L).toBeCloseTo(100, 1);
  });

  it('is zero for identical colours and large for black vs white', () => {
    const red = rgbToLab({ r: 200, g: 20, b: 20 });
    expect(deltaE(red, red)).toBe(0);
    expect(
      deltaE(rgbToLab({ r: 0, g: 0, b: 0 }), rgbToLab({ r: 255, g: 255, b: 255 })),
    ).toBeCloseTo(100, 0);
  });
});
