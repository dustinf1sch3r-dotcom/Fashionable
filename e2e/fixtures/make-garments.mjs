// Generates e2e/fixtures/garments/*.png: simple, recognisable garment cut-outs (transparent
// background, soft shading, darker edge) used to seed a realistic closet for screenshots and the
// Outfits e2e spec. Deterministic: no randomness. Run: node e2e/fixtures/make-garments.mjs
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('./garments/', import.meta.url);
const SUPER = 3; // samples per axis for anti-aliasing
const EDGE = 2.2; // outline width in output pixels

// ── shapes: each is { rings: [[x,y]...][], fill: '#rrggbb', edge?: boolean, alpha?: number } ──
const tee = (fill, rib) => [
  {
    rings: [
      [
        [232, 112],
        [262, 152],
        [300, 170],
        [338, 152],
        [368, 112],
        [432, 136],
        [548, 238],
        [500, 314],
        [436, 268],
        [436, 700],
        [164, 700],
        [164, 268],
        [100, 314],
        [52, 238],
        [168, 136],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [232, 112],
        [262, 152],
        [300, 170],
        [338, 152],
        [368, 112],
        [352, 108],
        [300, 138],
        [248, 108],
      ],
    ],
    fill: rib,
  },
];

const shirt = (fill, collar, button) => [
  {
    rings: [
      [
        [236, 110],
        [300, 160],
        [364, 110],
        [432, 134],
        [556, 250],
        [540, 640],
        [470, 640],
        [452, 330],
        [436, 330],
        [436, 720],
        [164, 720],
        [164, 330],
        [148, 330],
        [130, 640],
        [60, 640],
        [44, 250],
        [168, 134],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [296, 160],
        [304, 160],
        [304, 720],
        [296, 720],
      ],
    ],
    fill: collar,
  },
  {
    rings: [
      [
        [236, 110],
        [300, 160],
        [266, 196],
        [212, 150],
      ],
      [
        [364, 110],
        [300, 160],
        [334, 196],
        [388, 150],
      ],
    ],
    fill: collar,
  },
  ...[260, 360, 460, 560, 660].map((y) => ({
    rings: [
      [
        [296, y - 6],
        [304, y - 6],
        [304, y + 6],
        [296, y + 6],
      ],
    ],
    fill: button,
    edge: false,
  })),
];

const jacket = (fill, lapel, zip) => [
  {
    rings: [
      [
        [220, 90],
        [300, 130],
        [380, 90],
        [470, 118],
        [580, 236],
        [570, 700],
        [480, 700],
        [460, 330],
        [450, 330],
        [450, 640],
        [150, 640],
        [150, 330],
        [140, 330],
        [120, 700],
        [30, 700],
        [20, 236],
        [130, 118],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [220, 90],
        [300, 130],
        [300, 640],
        [285, 640],
        [230, 200],
      ],
      [
        [380, 90],
        [300, 130],
        [300, 640],
        [315, 640],
        [370, 200],
      ],
    ],
    fill: lapel,
  },
  {
    rings: [
      [
        [297, 130],
        [303, 130],
        [303, 640],
        [297, 640],
      ],
    ],
    fill: zip,
    edge: false,
  },
  {
    rings: [
      [
        [170, 470],
        [260, 470],
        [260, 500],
        [170, 500],
      ],
      [
        [340, 470],
        [430, 470],
        [430, 500],
        [340, 500],
      ],
    ],
    fill: lapel,
  },
];

const jeans = (fill, band, stitch) => [
  {
    rings: [
      [
        [10, 0],
        [250, 0],
        [274, 800],
        [148, 800],
        [130, 250],
        [112, 800],
        [-14, 800],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [10, 0],
        [250, 0],
        [252, 34],
        [8, 34],
      ],
    ],
    fill: band,
  },
  {
    rings: [
      [
        [28, 54],
        [100, 54],
        [100, 120],
        [64, 150],
        [28, 120],
      ],
      [
        [160, 54],
        [232, 54],
        [232, 120],
        [196, 150],
        [160, 120],
      ],
    ],
    fill: stitch,
    edge: false,
    alpha: 0.35,
  },
];

const trousers = (fill, band, crease) => [
  {
    rings: [
      [
        [14, 0],
        [246, 0],
        [262, 800],
        [150, 800],
        [130, 260],
        [110, 800],
        [-2, 800],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [14, 0],
        [246, 0],
        [247, 30],
        [13, 30],
      ],
    ],
    fill: band,
  },
  {
    rings: [
      [
        [56, 40],
        [62, 40],
        [56, 800],
        [48, 800],
      ],
      [
        [198, 40],
        [204, 40],
        [212, 800],
        [204, 800],
      ],
    ],
    fill: crease,
    edge: false,
    alpha: 0.35,
  },
];

const skirt = (fill, pleat) => [
  {
    rings: [
      [
        [50, 0],
        [210, 0],
        [300, 420],
        [-40, 420],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [50, 0],
        [210, 0],
        [212, 26],
        [48, 26],
      ],
    ],
    fill: pleat,
  },
  ...[-1, 0, 1, 2].map((k) => ({
    rings: [
      [
        [96 + k * 40, 26],
        [104 + k * 40, 26],
        [150 + k * 78, 420],
        [130 + k * 78, 420],
      ],
    ],
    fill: pleat,
    edge: false,
    alpha: 0.28,
  })),
];

const dress = (fill, belt) => [
  {
    rings: [
      [
        [70, 0],
        [92, 0],
        [112, 64],
        [148, 64],
        [168, 0],
        [190, 0],
        [184, 150],
        [300, 560],
        [-50, 560],
        [76, 150],
      ],
    ],
    fill,
  },
  {
    rings: [
      [
        [76, 150],
        [184, 150],
        [188, 178],
        [72, 178],
      ],
    ],
    fill: belt,
  },
];

/** A pair of shoes seen from the front, toes forward. `build` draws one shoe at x offset 0. */
const pair = (one) => [...one(0), ...one(150)];

const sneaker = (x, upper, sole, lace) => [
  {
    rings: [
      [
        [x + 4, 40],
        [x + 30, 10],
        [x + 86, 12],
        [x + 112, 60],
        [x + 118, 110],
        [x + 0, 110],
      ],
    ],
    fill: upper,
  },
  {
    rings: [
      [
        [x + 30, 24],
        [x + 86, 26],
        [x + 96, 56],
        [x + 22, 56],
      ],
    ],
    fill: lace,
    alpha: 0.7,
    edge: false,
  },
  {
    rings: [
      [
        [x - 2, 100],
        [x + 120, 100],
        [x + 122, 124],
        [x - 4, 124],
      ],
    ],
    fill: sole,
  },
];

const loafer = (x, upper, sole, trim) => [
  {
    rings: [
      [
        [x + 8, 50],
        [x + 40, 18],
        [x + 80, 18],
        [x + 112, 50],
        [x + 120, 110],
        [x + 0, 110],
      ],
    ],
    fill: upper,
  },
  {
    rings: [
      [
        [x + 30, 48],
        [x + 90, 48],
        [x + 96, 66],
        [x + 24, 66],
      ],
    ],
    fill: trim,
  },
  {
    rings: [
      [
        [x + 0, 104],
        [x + 120, 104],
        [x + 120, 124],
        [x + 0, 124],
      ],
    ],
    fill: sole,
  },
];

const boot = (x, upper, sole, sheen) => [
  {
    rings: [
      [
        [x + 18, 0],
        [x + 100, 0],
        [x + 104, 150],
        [x + 124, 200],
        [x + 128, 246],
        [x + 0, 246],
        [x + 8, 150],
      ],
    ],
    fill: upper,
  },
  {
    rings: [
      [
        [x + 26, 16],
        [x + 36, 16],
        [x + 36, 200],
        [x + 26, 200],
      ],
    ],
    fill: sheen,
    alpha: 0.3,
    edge: false,
  },
  {
    rings: [
      [
        [x - 4, 236],
        [x + 130, 236],
        [x + 132, 262],
        [x - 6, 262],
      ],
    ],
    fill: sole,
  },
];

export const GARMENTS = {
  'tee-navy': tee('#1f2a44', '#16203a'),
  'tee-white': tee('#f1eee6', '#dcd8cc'),
  'shirt-blue': shirt('#8fb3de', '#b9d0ec', '#f5f5f5'),
  'jacket-denim': jacket('#4f6f9c', '#3c5a85', '#c9d3e0'),
  'jeans-dark': jeans('#2b3f66', '#22334f', '#9fb2d4'),
  'trousers-grey': trousers('#5a5e68', '#4a4e57', '#2e3036'),
  'skirt-olive': skirt('#6f7650', '#58603f'),
  'dress-green': dress('#3f7d5c', '#2c5b42'),
  'sneakers-white': pair((x) => sneaker(x, '#f4f4f2', '#cfcfca', '#d9d9d4')),
  'loafers-brown': pair((x) => loafer(x, '#6b4a2f', '#2d1f14', '#8a6444')),
  'boots-black': pair((x) => boot(x, '#26262b', '#0f0f12', '#ffffff')),
};

// ── rasteriser ──
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function inside(rings, x, y) {
  let c = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

function edgeDistance(rings, x, y) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
      );
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  }
  return best;
}

const crc = (() => {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(shapes, targetHeight) {
  const pts = shapes.flatMap((s) => s.rings.flat());
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const scale = targetHeight / (maxY - minY);
  const width = Math.round((maxX - minX) * scale);
  const height = targetHeight;
  const place = (rings) =>
    rings.map((r) => r.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]));
  const placed = shapes.map((s) => ({ ...s, rings: place(s.rings) }));
  const out = Buffer.alloc(width * height * 4);
  // Output channels in premultiplied-free float, composited shape by shape.
  const acc = new Float32Array(width * height * 4);
  for (const s of placed) {
    const [r, g, b] = hex(s.fill);
    const baseAlpha = s.alpha ?? 1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let hit = 0;
        for (let sy = 0; sy < SUPER; sy++) {
          for (let sx = 0; sx < SUPER; sx++) {
            if (inside(s.rings, x + (sx + 0.5) / SUPER, y + (sy + 0.5) / SUPER)) hit++;
          }
        }
        if (hit === 0) continue;
        const cov = (hit / (SUPER * SUPER)) * baseAlpha;
        // Soft vertical shading plus a darker outline near the shape's edge.
        let k = 1 - 0.14 * (y / height);
        if (s.edge !== false) {
          const d = edgeDistance(s.rings, x + 0.5, y + 0.5);
          k *= 1 - 0.38 * Math.max(0, 1 - d / EDGE);
        }
        const i = (y * width + x) * 4;
        const a0 = acc[i + 3];
        const a = cov + a0 * (1 - cov);
        for (const [c, v] of [
          [0, r],
          [1, g],
          [2, b],
        ]) {
          acc[i + c] = (v * k * cov + acc[i + c] * a0 * (1 - cov)) / (a || 1);
        }
        acc[i + 3] = a;
      }
    }
  }
  for (let i = 0; i < acc.length; i++)
    out[i] = Math.max(0, Math.min(255, Math.round(i % 4 === 3 ? acc[i] * 255 : acc[i])));
  return { width, height, data: out };
}

mkdirSync(OUT, { recursive: true });
const sizes = {};
for (const [name, shapes] of Object.entries(GARMENTS)) {
  const { width, height, data } = render(shapes, 360);
  writeFileSync(new URL(`${name}.png`, OUT), png(width, height, data));
  sizes[name] = Number((width / height).toFixed(3));
}
writeFileSync(new URL('aspects.json', OUT), JSON.stringify(sizes, null, 2) + '\n');
console.log(sizes);
