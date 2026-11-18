import { ALIGN_MAX_LOSS, alignCutout } from '@/core/image/align';
import {
  BRUSH_SPACING,
  UndoStack,
  applyPatch,
  capturePatch,
  stampBrush,
  strokePoints,
  unionRect,
  type AlphaPatch,
  type Point,
} from '@/core/image/brush';
import { cropToWork, fitWithin, trimToAlpha, type CropRect } from '@/core/image';
import type { CutoutCrop } from '@/core/model/types';
import type { TouchupOpener, TouchupResult, TouchupSession } from '../types';
import { CUTOUT_MAX_PX, canvasToPng, context2d, loadImage, makeCanvas } from './canvas.web';

/** Longest side of the photo the editor works on (the stored original is at most 1600). */
const WORK_MAX_PX = 1600;
/** Longest side of the thumbnail (same as the add flow). */
const THUMB_MAX_PX = 256;
/** How visible the photo is through erased parts while restoring. */
const GHOST_ALPHA = 0.4;

export type { TouchupOpener } from '../types';

function readPixels(
  img: CanvasImageSource,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; data: ImageData } {
  const canvas = makeCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, data: ctx.getImageData(0, 0, width, height) };
}

/** Lets the browser paint (a "loading" state) before a long synchronous job. */
const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

class Session implements TouchupSession {
  private readonly alpha: Uint8ClampedArray;
  private readonly pixels: ImageData;
  private readonly garment: HTMLCanvasElement;
  private readonly garmentCtx: CanvasRenderingContext2D;
  private readonly photo: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly undoStack = new UndoStack<AlphaPatch>();
  private snapshot: Uint8ClampedArray | undefined;
  private dirty: CropRect | undefined;
  private last: Point | undefined;
  private mode: 'erase' | 'restore' = 'erase';
  private ghost = false;
  private readonly urls: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
    readonly canRestore: boolean,
    photo: { canvas: HTMLCanvasElement; data: ImageData },
    alpha: Uint8ClampedArray,
    canvas: HTMLCanvasElement,
    /** Factor from this session's pixels to original-photo pixels; undefined without photo space. */
    private readonly toOriginal?: number,
  ) {
    this.alpha = alpha;
    this.photo = photo.canvas;
    this.pixels = photo.data;
    for (let i = 0; i < alpha.length; i++) this.pixels.data[i * 4 + 3] = alpha[i];
    this.garment = makeCanvas(width, height);
    this.garmentCtx = context2d(this.garment);
    this.garmentCtx.putImageData(this.pixels, 0, 0);
    canvas.width = width;
    canvas.height = height;
    this.ctx = context2d(canvas);
    this.render();
  }

  private render(): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.ghost) {
      ctx.globalAlpha = GHOST_ALPHA;
      ctx.drawImage(this.photo, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(this.garment, 0, 0);
  }

  /** Copies mask values in `rect` into the pixel buffer and the garment canvas. */
  private sync(rect: CropRect): void {
    const { data } = this.pixels;
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const i = y * this.width + x;
        data[i * 4 + 3] = this.alpha[i];
      }
    }
    this.garmentCtx.putImageData(this.pixels, 0, 0, rect.x, rect.y, rect.width, rect.height);
  }

  beginStroke(mode: 'erase' | 'restore'): void {
    this.mode = mode === 'restore' && !this.canRestore ? 'erase' : mode;
    this.snapshot = this.alpha.slice();
    this.dirty = undefined;
    this.last = undefined;
  }

  strokeTo(x: number, y: number, radius: number): void {
    if (!this.snapshot) return;
    const to = { x, y };
    let touched: CropRect | undefined;
    for (const p of strokePoints(this.last, to, radius * BRUSH_SPACING)) {
      const rect = stampBrush(this.alpha, this.width, this.height, p.x, p.y, radius, this.mode);
      if (rect) touched = unionRect(touched, rect);
    }
    this.last = to;
    if (!touched) return;
    this.dirty = unionRect(this.dirty, touched);
    this.sync(touched);
    this.render();
  }

  endStroke(): number {
    if (this.snapshot && this.dirty) {
      this.undoStack.push(capturePatch(this.snapshot, this.width, this.dirty));
    }
    this.snapshot = undefined;
    this.dirty = undefined;
    this.last = undefined;
    return this.undoStack.size;
  }

  undo(): number {
    const patch = this.undoStack.pop();
    if (patch) {
      applyPatch(this.alpha, this.width, patch);
      this.sync(patch);
      this.render();
    }
    return this.undoStack.size;
  }

  setGhost(on: boolean): void {
    if (on === this.ghost) return;
    this.ghost = on;
    this.render();
  }

  async finish(): Promise<TouchupResult | undefined> {
    const rect = trimToAlpha(this.pixels.data, this.width, this.height);
    if (!rect) return undefined;
    const size = fitWithin(rect.width, rect.height, CUTOUT_MAX_PX);
    const out = makeCanvas(size.width, size.height);
    context2d(out).drawImage(
      this.garment,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      size.width,
      size.height,
    );
    const thumbSize = fitWithin(size.width, size.height, THUMB_MAX_PX);
    const thumb = makeCanvas(thumbSize.width, thumbSize.height);
    context2d(thumb).drawImage(out, 0, 0, thumbSize.width, thumbSize.height);
    const [imageBlob, thumbBlob] = await Promise.all([canvasToPng(out), canvasToPng(thumb)]);
    const url = (blob: Blob) => {
      const u = URL.createObjectURL(blob);
      this.urls.push(u);
      return u;
    };
    const k = this.toOriginal;
    const crop: CutoutCrop | undefined =
      k === undefined
        ? undefined
        : {
            x: rect.x * k,
            y: rect.y * k,
            width: rect.width * k,
            height: rect.height * k,
            scale: size.width / (rect.width * k),
          };
    return {
      image: { uri: url(imageBlob), ...size },
      thumb: { uri: url(thumbBlob), ...thumbSize },
      ...(crop ? { crop } : {}),
    };
  }

  dispose(): void {
    // The result's object URLs are handed to the caller, who saves them; they are not revoked here.
    this.snapshot = undefined;
  }
}

async function open(source: {
  originalUri: string;
  cutoutUri?: string;
  crop?: CutoutCrop;
  canvas: HTMLCanvasElement;
}): Promise<TouchupSession> {
  const original = await loadImage(source.originalUri);
  const size = fitWithin(original.naturalWidth, original.naturalHeight, WORK_MAX_PX);
  const photo = readPixels(original, size.width, size.height);
  const total = size.width * size.height;
  // Work pixels to original pixels (1 unless the stored original is larger than the work size).
  const toOriginal = original.naturalWidth / size.width;

  if (!source.cutoutUri) {
    const alpha = new Uint8ClampedArray(total).fill(255);
    return new Session(size.width, size.height, true, photo, alpha, source.canvas, toOriginal);
  }

  const cutImg = await loadImage(source.cutoutUri);
  const cw = cutImg.naturalWidth;
  const ch = cutImg.naturalHeight;

  /** Alpha of the cutout drawn into the photo's space at `at`. */
  const placeAlpha = (at: CropRect): Uint8ClampedArray => {
    const placed = makeCanvas(size.width, size.height);
    const placedCtx = context2d(placed);
    placedCtx.drawImage(cutImg, at.x, at.y, at.width, at.height);
    const { data } = placedCtx.getImageData(0, 0, size.width, size.height);
    const alpha = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i++) alpha[i] = data[i * 4 + 3];
    return alpha;
  };

  if (source.crop) {
    // The recorded crop says exactly where the cutout sits: no search, no waiting.
    const at = cropToWork(
      source.crop,
      { width: original.naturalWidth, height: original.naturalHeight },
      size,
    );
    return new Session(
      size.width,
      size.height,
      true,
      photo,
      placeAlpha(at),
      source.canvas,
      toOriginal,
    );
  }

  // Older items have no crop: find it by matching colours.
  const cut = readPixels(cutImg, cw, ch);
  await nextFrame();
  const found = alignCutout(photo.data.data, size.width, size.height, cut.data.data, cw, ch);

  if (found.loss <= ALIGN_MAX_LOSS) {
    return new Session(
      size.width,
      size.height,
      true,
      photo,
      placeAlpha(found),
      source.canvas,
      toOriginal,
    );
  }

  // Cannot line the cutout up with the photo: work on the cutout alone, erase only.
  const alpha = new Uint8ClampedArray(cw * ch);
  for (let i = 0; i < alpha.length; i++) alpha[i] = cut.data.data[i * 4 + 3];
  return new Session(cw, ch, false, cut, alpha, source.canvas);
}

export function createTouchupOpener(): TouchupOpener {
  return { available: true, open };
}
