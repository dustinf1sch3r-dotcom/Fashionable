import type { AlphaMask } from '../fit/contract';
import type { Point } from '../model/types';
import { createRng } from './rng';

/**
 * Procedurally drawn garment cutouts for fit tests: a polygon per garment in a 100-wide design
 * space, with the construction points the rig should find. No canvas; pure arithmetic.
 */
export type GarmentName =
  | 'tee'
  | 'longSleeve'
  | 'sleevelessTop'
  | 'coat'
  | 'jeans'
  | 'wideLeg'
  | 'shorts'
  | 'aLineSkirt'
  | 'pencilSkirt'
  | 'sleevedDress'
  | 'sleevelessDress'
  | 'jumpsuit';

export interface GarmentMaskOptions {
  /** Mask height in px before rotation (default 240). */
  height?: number;
  /** Rotation in degrees, clockwise on screen (default 0). */
  rotate?: number;
  /** 0–1: edge flips, specks and pinholes (default 0). */
  noise?: number;
  seed?: number;
  /** Transparent margin in px; 0 makes the garment touch the mask edge (default 10). */
  margin?: number;
}

export interface GarmentMask {
  mask: AlphaMask;
  /** Construction points, normalised 0–1 in the mask. */
  truth: Record<string, Point>;
  /** Mask width ÷ height. */
  aspect: number;
}

type P = [number, number];
interface Design {
  /** Left half from the collar dip, top to bottom; mirrored about x = 50 to close. */
  chain: P[];
  /** Named construction points of the left side (right side is mirrored). */
  truthL: Record<string, P>;
  /** Extra non-mirrored truth. */
  center?: Record<string, P>;
}

const DIP: P[] = [
  [50, 12],
  [43, 9],
];

const DESIGNS: Record<GarmentName, Design> = {
  tee: {
    chain: [...DIP, [38, 2], [24, 7], [5, 22], [16.2, 30.3], [24, 28], [24, 88]],
    truthL: {
      neck: [38, 2],
      shoulder: [24, 7],
      cuffOuter: [5, 22],
      cuffInner: [16.2, 30.3],
      armpit: [24, 28],
      hem: [24, 88],
    },
  },
  longSleeve: {
    chain: [...DIP, [38, 2], [26, 5.3], [6, 80], [17, 82], [26, 30], [26, 90]],
    truthL: {
      neck: [38, 2],
      shoulder: [26, 5.3],
      cuffOuter: [6, 80],
      cuffInner: [17, 82],
      armpit: [26, 30],
      hem: [26, 90],
    },
  },
  sleevelessTop: {
    chain: [
      [50, 14],
      [44, 11],
      [38, 3],
      [30, 3],
      [27.5, 10],
      [25, 18],
      [24, 26],
      [24, 88],
    ],
    truthL: { neck: [38, 3], shoulder: [30, 3], armpit: [24, 26], hem: [24, 88] },
  },
  coat: {
    chain: [...DIP, [38, 2], [27, 5], [6, 80], [18, 81], [27, 30], [24, 100]],
    truthL: {
      neck: [38, 2],
      shoulder: [27, 5],
      cuffOuter: [6, 80],
      cuffInner: [18, 81],
      armpit: [27, 30],
      hem: [24, 100],
    },
  },
  jeans: {
    chain: [
      [30, 0],
      [26, 18.2],
      [31, 100],
      [46.5, 100],
      [50, 26],
    ],
    truthL: { waist: [30, 0], hip: [26, 18.2], hemOuter: [31, 100], hemInner: [46.5, 100] },
    center: { crotch: [50, 26] },
  },
  wideLeg: {
    chain: [
      [30, 0],
      [27, 21],
      [6, 100],
      [41, 100],
      [50, 30],
    ],
    truthL: { waist: [30, 0], hip: [27, 21], hemOuter: [6, 100], hemInner: [41, 100] },
    center: { crotch: [50, 30] },
  },
  shorts: {
    chain: [
      [30, 0],
      [26.5, 12.6],
      [24, 40],
      [45, 40],
      [50, 18],
    ],
    truthL: { waist: [30, 0], hip: [26.5, 12.6], hemOuter: [24, 40], hemInner: [45, 40] },
    center: { crotch: [50, 18] },
  },
  aLineSkirt: {
    chain: [
      [32, 0],
      [10, 60],
    ],
    truthL: { waist: [32, 0], hip: [27.6, 12], hem: [10, 60] },
  },
  pencilSkirt: {
    chain: [
      [32, 0],
      [28, 14],
      [33, 70],
    ],
    truthL: { waist: [32, 0], hip: [28, 14], hem: [33, 70] },
  },
  sleevedDress: {
    chain: [...DIP, [38, 2], [26, 6], [6, 22], [17, 31], [26, 29], [34, 40], [14, 110]],
    truthL: {
      neck: [38, 2],
      shoulder: [26, 6],
      cuffOuter: [6, 22],
      cuffInner: [17, 31],
      armpit: [26, 29],
      waist: [34, 40],
      hip: [30, 54],
      hem: [14, 110],
    },
  },
  sleevelessDress: {
    chain: [
      [50, 14],
      [44, 11],
      [38, 3],
      [31, 3],
      [28.5, 10],
      [26.5, 19],
      [26, 26],
      [34, 40],
      [14, 110],
    ],
    truthL: {
      neck: [38, 3],
      shoulder: [31, 3],
      armpit: [26, 26],
      waist: [34, 40],
      hip: [30, 54],
      hem: [14, 110],
    },
  },
  jumpsuit: {
    chain: [
      ...DIP,
      [38, 2],
      [26, 6],
      [6, 22],
      [17, 31],
      [26, 29],
      [35, 40],
      [28, 52],
      [30, 125],
      [46, 125],
      [50, 62],
    ],
    truthL: {
      neck: [38, 2],
      shoulder: [26, 6],
      cuffOuter: [6, 22],
      cuffInner: [17, 31],
      armpit: [26, 29],
      waist: [35, 40],
      hip: [28.1, 55.4],
      hemOuter: [30, 125],
      hemInner: [46, 125],
    },
    center: { crotch: [50, 62] },
  },
};

/** Draw a garment cutout and its ground-truth rig points. */
export function garmentMask(name: GarmentName, opts: GarmentMaskOptions = {}): GarmentMask {
  const design = DESIGNS[name];
  const size = opts.height ?? 240;
  const margin = opts.margin ?? 10;
  const angle = ((opts.rotate ?? 0) * Math.PI) / 180;
  const noise = opts.noise ?? 0;
  const rng = createRng(opts.seed ?? 1);

  const mirror = (p: P): P => [100 - p[0], p[1]];
  const outline: P[] = [...design.chain, ...[...design.chain].reverse().map(mirror)];
  // Names to design points (left, right, centre).
  const named: Record<string, P> = {};
  for (const [k, v] of Object.entries(design.truthL)) {
    named[`${k}L`] = v;
    named[`${k}R`] = mirror(v);
  }
  for (const [k, v] of Object.entries(design.center ?? {})) named[k] = v;

  const all: P[] = [...outline, ...Object.values(named)];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of all) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const scale = size / (maxY - minY);
  const cx = 50;
  const cy = (minY + maxY) / 2;
  const rot = (p: P): P => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    return [
      dx * Math.cos(angle) - dy * Math.sin(angle),
      dx * Math.sin(angle) + dy * Math.cos(angle),
    ];
  };
  const rotated = all.map(rot);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of rotated.slice(0, outline.length)) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  const width = Math.ceil((x1 - x0) * scale) + 2 * margin;
  const height = Math.ceil((y1 - y0) * scale) + 2 * margin;
  const toPx = (p: P): P => [(p[0] - x0) * scale + margin, (p[1] - y0) * scale + margin];
  const polyPx = rotated.slice(0, outline.length).map(toPx);

  const alpha = new Uint8Array(width * height);
  // Scanline fill (even-odd) sampled at pixel centres.
  for (let y = 0; y < height; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0, j = polyPx.length - 1; i < polyPx.length; j = i++) {
      const [xi, yi] = polyPx[i] as P;
      const [xj, yj] = polyPx[j] as P;
      if (yi > cy !== yj > cy) xs.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil((xs[k] as number) - 0.5));
      const to = Math.min(width, Math.ceil((xs[k + 1] as number) - 0.5));
      for (let x = from; x < to; x++) alpha[y * width + x] = 255;
    }
  }
  if (noise > 0) {
    const copy = alpha.slice();
    const at = (x: number, y: number): number =>
      x < 0 || y < 0 || x >= width || y >= height ? 0 : (copy[y * width + x] as number);
    // Ragged edges: boundary pixels flip.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = at(x, y);
        const edge =
          at(x - 1, y) !== v || at(x + 1, y) !== v || at(x, y - 1) !== v || at(x, y + 1) !== v;
        if (edge && rng.next() < 0.25 * noise) alpha[y * width + x] = v === 0 ? 255 : 0;
      }
    }
    // Stray specks outside and pinholes inside.
    const specks = Math.round(10 * noise);
    for (let i = 0; i < specks; i++) {
      const sx = rng.int(0, width - 4);
      const sy = rng.int(0, height - 4);
      const outside = at(sx + 1, sy + 1) === 0 && at(sx, sy) === 0 && at(sx + 3, sy + 3) === 0;
      const inside = at(sx + 1, sy + 1) !== 0 && at(sx, sy) !== 0 && at(sx + 3, sy + 3) !== 0;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          if (outside) alpha[(sy + dy) * width + sx + dx] = 255;
          else if (inside && dx < 2 && dy < 2) alpha[(sy + dy) * width + sx + dx] = 0;
        }
      }
    }
  }
  const truth: Record<string, Point> = {};
  Object.keys(named).forEach((k, i) => {
    const [px, py] = toPx(rotated[outline.length + i] as P);
    truth[k] = { x: px / width, y: py / height };
  });
  return { mask: { width, height, alpha }, truth, aspect: width / height };
}
