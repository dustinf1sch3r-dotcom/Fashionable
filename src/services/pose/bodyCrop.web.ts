import { canvasToJpeg, context2d, loadImage, makeCanvas } from '../pixels/canvas.web';
import type { BodyPhotoCropper } from '../types';
import { planCrop } from './cropPlan';

/** Body photo crop for the web: a canvas draw of the window, scaled to the output size. */
export function createBodyPhotoCropper(): BodyPhotoCropper {
  return {
    available: typeof document !== 'undefined',
    async crop(imageUri, window, output) {
      const img = await loadImage(imageUri);
      const canvas = makeCanvas(output.width, output.height);
      const ctx = context2d(canvas);
      ctx.fillStyle = output.fill;
      ctx.fillRect(0, 0, output.width, output.height);
      const plan = planCrop(window, { width: img.naturalWidth, height: img.naturalHeight }, output);
      if (plan) {
        ctx.drawImage(img, plan.sx, plan.sy, plan.sw, plan.sh, plan.dx, plan.dy, plan.dw, plan.dh);
      }
      const blob = await canvasToJpeg(canvas, 0.9);
      return { uri: URL.createObjectURL(blob), blob };
    },
  };
}
