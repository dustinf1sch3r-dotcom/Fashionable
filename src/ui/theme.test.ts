import { contrastRatio } from './contrast';
import { colors, minTouch, shadow } from './theme';

const AA = 4.5;

const PAIRS: [string, string, string][] = [
  ['text', colors.text, colors.bg],
  ['text', colors.text, colors.surface],
  ['text', colors.text, colors.surfaceAlt],
  ['text', colors.text, colors.accentSoft],
  ['textMuted', colors.textMuted, colors.bg],
  ['textMuted', colors.textMuted, colors.surface],
  ['textMuted', colors.textMuted, colors.surfaceAlt],
  ['accent', colors.accent, colors.bg],
  ['accent', colors.accent, colors.surface],
  ['accent', colors.accent, colors.accentSoft],
  ['onAccent', colors.onAccent, colors.accent],
  ['onAccent', colors.onAccent, colors.danger],
  ['success', colors.success, colors.bg],
  ['warning', colors.warning, colors.bg],
  ['danger', colors.danger, colors.bg],
  ['danger', colors.danger, colors.surface],
];

describe('theme contrast (WCAG AA)', () => {
  it('computes known reference ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it.each(PAIRS)('%s on %s meets 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});

describe('theme helpers', () => {
  it('keeps the minimum touch target at 44', () => {
    expect(minTouch).toBe(44);
  });

  it('shadow returns a style object for every level', () => {
    for (const level of [1, 2, 3] as const) {
      expect(Object.keys(shadow(level)).length).toBeGreaterThan(0);
    }
  });
});
