import type { PixelData, PixelReader } from '../types';

export type { PixelData, PixelReader } from '../types';

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = uri;
  });
}

/** Draws the image onto a canvas whose longest side is `maxSize` and reads its RGBA pixels. */
export function createPixelReader(): PixelReader {
  return {
    async read(uri, maxSize): Promise<PixelData | undefined> {
      const img = await loadImage(uri);
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest === 0) return undefined;
      const scale = Math.min(1, maxSize / longest);
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0, width, height);
      return { width, height, rgba: ctx.getImageData(0, 0, width, height).data };
    },
  };
}
