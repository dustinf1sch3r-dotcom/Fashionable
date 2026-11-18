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
import { fitWithin, trimToAlpha, type CropRect } from '@/core/image';
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
    return {
      image: { uri: url(imageBlob), ...size },
      thumb: { uri: url(thumbBlob), ...thumbSize },
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
  canvas: HTMLCanvasElement;
}): Promise<TouchupSession> {
  const original = await loadImage(source.originalUri);
  const size = fitWithin(original.naturalWidth, original.naturalHeight, WORK_MAX_PX);
  const photo = readPixels(original, size.width, size.height);
  const total = size.width * size.height;

  if (!source.cutoutUri) {
    const alpha = new Uint8ClampedArray(total).fill(255);
    return new Session(size.width, size.height, true, photo, alpha, source.canvas);
  }

  const cutImg = await loadImage(source.cutoutUri);
  const cw = cutImg.naturalWidth;
  const ch = cutImg.naturalHeight;
  const cut = readPixels(cutImg, cw, ch);
  await nextFrame();
  const found = alignCutout(photo.data.data, size.width, size.height, cut.data.data, cw, ch);

  if (found.loss <= ALIGN_MAX_LOSS) {
    const placed = makeCanvas(size.width, size.height);
    context2d(placed).drawImage(cutImg, found.x, found.y, found.width, found.height);
    const { data } = context2d(placed).getImageData(0, 0, size.width, size.height);
    const alpha = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i++) alpha[i] = data[i * 4 + 3];
    return new Session(size.width, size.height, true, photo, alpha, source.canvas);
  }

  // Cannot line the cutout up with the photo: work on the cutout alone, erase only.
  const alpha = new Uint8ClampedArray(cw * ch);
  for (let i = 0; i < alpha.length; i++) alpha[i] = cut.data.data[i * 4 + 3];
  return new Session(cw, ch, false, cut, alpha, source.canvas);
}

export function createTouchupOpener(): TouchupOpener {
  return { available: true, open };
}
