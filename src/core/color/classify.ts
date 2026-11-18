import type { ColorName, ColorSwatch, Material } from '../model/types';
import { hexToRgb, hueDistance, rgbToHsl } from './hsl';
import type { Hsl, Rgb } from './hsl';

export interface Lab {
  L: number;
  a: number;
  b: number;
}

/** sRGB (0-255, D65) to CIE L*a*b*. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r);
  const gl = lin(g);
  const bl = lin(b);
  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
  const z = (0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 colour difference (Euclidean distance in Lab). */
export function deltaE(p: Lab, q: Lab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

export const NEUTRAL_COLOR_NAMES: readonly ColorName[] = [
  'black',
  'white',
  'grey',
  'navy',
  'beige',
  'brown',
  'olive',
];

/**
 * Map any hex to one of the 15 ColorName values using ordered HSL rules (lightness first, then
 * saturation, then hue bands). Rule-based rather than nearest-prototype so that dark/desaturated
 * variants land in navy/brown/olive/beige.
 */
export function nameColor(hex: string): ColorName {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));

  if (l < 0.1 || (l < 0.16 && s < 0.25)) return 'black';
  if (l >= 0.94 || (l >= 0.88 && s < 0.3)) return 'white';
  if (s < 0.12) return l < 0.1 ? 'black' : 'grey';

  // Warm earthy hues: brown (dark), beige (light, muted), olive (dark yellow-green).
  if (h >= 10 && h < 45) {
    if (l < 0.45) return 'brown';
    if (s < 0.55 && l >= 0.55) return 'beige';
    if (s < 0.5) return 'brown';
    return 'orange';
  }
  if (h >= 45 && h < 65) {
    if (l < 0.42) return 'olive';
    if (s < 0.6 && l >= 0.55) return 'beige';
    if (s < 0.4) return 'olive';
    return 'yellow';
  }
  if (h >= 65 && h < 100) {
    if (l < 0.45 && s < 0.6) return 'olive';
    return 'green';
  }
  if (h >= 100 && h < 165) return 'green';
  if (h >= 165 && h < 200) return 'teal';
  if (h >= 200 && h < 255) return l < 0.28 ? 'navy' : 'blue';
  if (h >= 255 && h < 315) return l < 0.18 ? 'navy' : 'purple';
  if (h >= 315 && h < 345) return 'pink';
  // Red band: 345-360 and 0-10.
  return l > 0.7 ? 'pink' : 'red';
}

type ColorLike = string | (Pick<ColorSwatch, 'hex'> & Partial<Pick<ColorSwatch, 'name'>>);

/**
 * Neutral per OUTFIT_ENGINE §4.1: black, white, grey, navy, beige, brown, olive; denim items are
 * neutral whatever their hue.
 */
export function isNeutral(color: ColorLike, material?: Material): boolean {
  if (material === 'denim') return true;
  const name = typeof color === 'string' ? nameColor(color) : (color.name ?? nameColor(color.hex));
  return NEUTRAL_COLOR_NAMES.includes(name);
}

/**
 * Group accents into hue families: single-linkage, so an accent joins a family if its hue is
 * within 30 degrees of ANY member (transitive). Families keep first-appearance order.
 */
export function hueFamilies<T extends Pick<Hsl, 'h'>>(accents: readonly T[]): T[][] {
  const parent = accents.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    parent[i] = root;
    return root;
  };
  for (let i = 0; i < accents.length; i++) {
    for (let j = i + 1; j < accents.length; j++) {
      if (hueDistance(accents[i].h, accents[j].h) <= 30) {
        parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map<number, T[]>();
  accents.forEach((a, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(a);
    else groups.set(root, [a]);
  });
  return [...groups.values()];
}

/** Circular mean of hues in degrees, [0,360). */
export function meanHue(hues: readonly number[]): number {
  let x = 0;
  let y = 0;
  for (const h of hues) {
    x += Math.cos((h * Math.PI) / 180);
    y += Math.sin((h * Math.PI) / 180);
  }
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}
