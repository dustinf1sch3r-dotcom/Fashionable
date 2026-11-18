import type { CompositeLayer, RGBAImage } from '@/core/composite';
import { BODY_A_PARTS, CANVAS, MIRROR_TRANSFORM } from '@/core/tryon/silhouetteArt';
import { canvasToJpeg, context2d, loadImage, makeCanvas } from '../pixels/canvas.web';
import type { OutfitCompositor } from '../types';
import { layerBox, outputSize } from './geometry';
import { createPipelineRunner } from './pipelineRunner';

/** JPEG quality of the merged picture. */
const JPEG_QUALITY = 0.9;

const DEFAULT_PALETTE = { background: '#FAF8F5', figure: '#C9CCD1' } as const;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Records a User Timing measure (visible in devtools and to tests); a no-op where unsupported. */
function mark(name: string, start: number, width: number): void {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
  try {
    performance.measure(name, { start, duration: now() - start, detail: { width } });
  } catch {
    // Timing is only a diagnostic.
  }
}

/** Lets the browser paint and handle input between two heavy steps. */
const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function readPixels(canvas: HTMLCanvasElement): RGBAImage {
  const ctx = context2d(canvas);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data };
}

/** The silhouette artwork as an SVG document at the output size. */
function silhouetteSvg(
  width: number,
  height: number,
  palette: { background: string; figure: string },
) {
  const path = (d: string) => `<path d="${d}" fill="${palette.figure}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">` +
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${palette.background}"/>` +
    BODY_A_PARTS.whole.map(path).join('') +
    BODY_A_PARTS.pairedLeft.map(path).join('') +
    `<g transform="${MIRROR_TRANSFORM}">${BODY_A_PARTS.pairedLeft.map(path).join('')}</g>` +
    '</svg>'
  );
}

async function drawBackdrop(
  canvas: HTMLCanvasElement,
  input: Parameters<OutfitCompositor['compose']>[0],
): Promise<void> {
  const ctx = context2d(canvas);
  if (input.kind === 'silhouette') {
    const svg = silhouetteSvg(canvas.width, canvas.height, input.palette ?? DEFAULT_PALETTE);
    const img = await loadImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return;
  }
  const img = await loadImage(input.backdropUri);
  if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new Error('Empty backdrop');
  // The Mannequin draws the photo "cover" in a 1:2 box; the photo is already cropped to 1:2.
  const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

/**
 * Merges a garment layer into its own RGBA buffer on the output grid: the image is drawn into the
 * bounding box of its (possibly rotated) rectangle, clipped to the canvas.
 */
function layerPixels(
  img: HTMLImageElement,
  box: NonNullable<ReturnType<typeof layerBox>>,
): CompositeLayer {
  const canvas = makeCanvas(box.width, box.height);
  const ctx = context2d(canvas);
  ctx.translate(box.centerX, box.centerY);
  ctx.rotate(box.angle);
  ctx.drawImage(img, -box.drawWidth / 2, -box.drawHeight / 2, box.drawWidth, box.drawHeight);
  return { image: readPixels(canvas), x: box.x, y: box.y };
}

/**
 * Renders the merged outfit on the main thread (docs/TRY_ON.md §13.2): decode the backdrop and
 * each layer to pixels, run the pure pipeline (`compositeOutfit`), encode a JPEG object URL. The
 * browser gets a turn between steps (one macrotask per layer, before the pipeline and before
 * encoding), so touches keep working while an outfit is merged.
 */
export function createOutfitCompositor(): OutfitCompositor {
  const runPipeline = createPipelineRunner();
  return {
    available: typeof document !== 'undefined',
    async compose(input) {
      const started = now();
      const { width, height } = outputSize(input.pixelsPerUnit);
      const ppu = width / CANVAS.width;

      const backdropCanvas = makeCanvas(width, height);
      const [images] = await Promise.all([
        Promise.all(input.layers.map((l) => loadImage(l.uri))),
        drawBackdrop(backdropCanvas, input),
      ]);
      const backdrop = readPixels(backdropCanvas);

      const layers: CompositeLayer[] = [];
      for (let i = 0; i < input.layers.length; i += 1) {
        const spec = input.layers[i];
        const img = images[i];
        const box = spec ? layerBox(spec, ppu, width, height) : undefined;
        if (!spec || !img || !box || img.naturalWidth === 0) continue;
        await yieldToBrowser();
        layers.push(layerPixels(img, box));
      }

      await yieldToBrowser();
      const pipelineStart = now();
      const merged = await runPipeline({
        backdrop,
        kind: input.kind,
        layers,
        density: ppu,
        seed: input.seed,
      });
      mark('composite-pipeline', pipelineStart, width);

      await yieldToBrowser();
      const out = makeCanvas(merged.width, merged.height);
      const ctx = context2d(out);
      const pixels = ctx.createImageData(merged.width, merged.height);
      pixels.data.set(merged.data);
      ctx.putImageData(pixels, 0, 0);
      const blob = await canvasToJpeg(out, JPEG_QUALITY);
      const uri = URL.createObjectURL(blob);
      mark('composite-render', started, width);
      return { uri };
    },
    release(uri) {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    },
  };
}
