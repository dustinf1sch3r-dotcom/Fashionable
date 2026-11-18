import { canvasToPng, loadImage, makeCanvas } from '../pixels/canvas.web';
import type { GarmentWarper } from '../types';
import { expandTriangle, pointsBounds, triangleAffine, type Pt } from './triangles';

/** Never draw a canvas larger than this per side (memory on phones). */
const MAX_SIDE_PX = 2400;
/** Triangles grow by this many output pixels so neighbours overlap and no seams show. */
const SEAM_PX = 0.5;
/** The source is shrunk to at most this many times the output size before it is sampled. */
const SOURCE_OVERSAMPLE = 2;

type Drawable = HTMLImageElement | HTMLCanvasElement;

/**
 * Shrinks `img` in halving steps until it is within `SOURCE_OVERSAMPLE`× of `scale` (output pixels
 * per source pixel). A single large downscale in `drawImage` aliases; halving behaves like a
 * mip chain and keeps fabric edges smooth.
 */
function prefilter(img: HTMLImageElement, scale: number): Drawable {
  let current: Drawable = img;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const goalW = Math.max(1, Math.ceil(img.naturalWidth * scale * SOURCE_OVERSAMPLE));
  while (w > goalW && w > 8) {
    const nw = Math.max(goalW, Math.ceil(w / 2));
    const nh = Math.max(1, Math.round((h * nw) / w));
    const step = makeCanvas(nw, nh);
    const ctx = step.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, nw, nh);
    current = step;
    w = nw;
    h = nh;
  }
  return current;
}

function drawableSize(d: Drawable): { width: number; height: number } {
  return d instanceof HTMLImageElement
    ? { width: d.naturalWidth, height: d.naturalHeight }
    : { width: d.width, height: d.height };
}

/**
 * Draws a garment cutout through a fit mesh on a canvas (docs/TRY_ON.md §12.5): every triangle is
 * clipped to its (slightly grown) target and filled with the source texture through the affine map
 * between the two triangles. The result is a PNG object URL covering `mesh.bounds`.
 */
export function createGarmentWarper(): GarmentWarper {
  return {
    available: typeof document !== 'undefined',
    async render(cutoutUri, mesh, pixelsPerUnit) {
      const started = typeof performance !== 'undefined' ? performance.now() : 0;
      const { bounds } = mesh;
      if (!(bounds.width > 0) || !(bounds.height > 0)) throw new Error('The fit mesh is empty');
      const ppu = Math.min(pixelsPerUnit, MAX_SIDE_PX / bounds.width, MAX_SIDE_PX / bounds.height);
      const outW = Math.max(1, Math.ceil(bounds.width * ppu));
      const outH = Math.max(1, Math.ceil(bounds.height * ppu));
      // Exact scale per axis so the image covers `bounds` edge to edge.
      const sx = outW / bounds.width;
      const sy = outH / bounds.height;

      const img = await loadImage(cutoutUri);
      if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new Error('Empty cutout');

      const toOut = (p: Pt): Pt => ({ x: (p.x - bounds.x) * sx, y: (p.y - bounds.y) * sy });
      const outPts = mesh.target.map(toOut);
      // Output pixels per source pixel, from the mesh's overall area ratio.
      let outArea = 0;
      for (const [a, b, c] of mesh.triangles) {
        const p = outPts[a];
        const q = outPts[b];
        const r = outPts[c];
        if (!p || !q || !r) continue;
        outArea += Math.abs((q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y)) / 2;
      }
      const srcArea = img.naturalWidth * img.naturalHeight * 0.5; // mesh covers the unit square
      const ratio = Math.sqrt(Math.max(outArea, 1) / srcArea);
      const source = ratio < 1 ? prefilter(img, ratio) : img;
      const { width: srcW, height: srcH } = drawableSize(source);

      const canvas = makeCanvas(outW, outH);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D is not available');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      for (const [ia, ib, ic] of mesh.triangles) {
        const sa = mesh.source[ia];
        const sb = mesh.source[ib];
        const sc = mesh.source[ic];
        const ta = outPts[ia];
        const tb = outPts[ib];
        const tc = outPts[ic];
        if (!sa || !sb || !sc || !ta || !tb || !tc) continue;
        const from: [Pt, Pt, Pt] = [
          { x: sa.x * srcW, y: sa.y * srcH },
          { x: sb.x * srcW, y: sb.y * srcH },
          { x: sc.x * srcW, y: sc.y * srcH },
        ];
        const m = triangleAffine(from, [ta, tb, tc]);
        if (!m) continue;
        const clip = expandTriangle([ta, tb, tc], SEAM_PX);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(clip[0].x, clip[0].y);
        ctx.lineTo(clip[1].x, clip[1].y);
        ctx.lineTo(clip[2].x, clip[2].y);
        ctx.closePath();
        ctx.clip();
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        // Only the part of the texture this triangle can show (grown by a pixel for filtering).
        const box = pointsBounds(from);
        const x0 = Math.max(0, Math.floor(box.x0) - 2);
        const y0 = Math.max(0, Math.floor(box.y0) - 2);
        const x1 = Math.min(srcW, Math.ceil(box.x1) + 2);
        const y1 = Math.min(srcH, Math.ceil(box.y1) + 2);
        if (x1 > x0 && y1 > y0) {
          ctx.drawImage(source, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
        }
        ctx.restore();
      }

      const blob = await canvasToPng(canvas);
      const uri = URL.createObjectURL(blob);
      if (typeof performance !== 'undefined') {
        const ms = performance.now() - started;
        performance.measure('fit-render', { start: started, duration: ms });
      }
      return { uri, bounds: { ...bounds } };
    },
    release(uri) {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    },
  };
}
