import type { BodyLandmarks } from '@/core/model/types';
import {
  BLOCKING_POSE_PROBLEMS,
  bodyCropWindow,
  defaultPhotoLandmarks,
  fromBlazePose,
  toCanvas,
  type PixelRect,
  type PoseProblem,
} from '@/core/tryon/pose';
import type { Services } from '@/services';
import { colors } from '@/ui/theme';

export type PipelineServices = Pick<Services, 'pose' | 'bodyCrop'>;

/** A photo the person picked (dimensions in pixels, as the picker reports them). */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** A photo cropped to the 1000 × 2000 canvas with its landmarks in mannequin units. */
export interface PreparedPhoto {
  /** Displayable URI of the cropped image (for the correction screen). */
  uri: string;
  blob: Blob;
  landmarks: BodyLandmarks;
  /** What the detector found; absent when the points were placed by hand. */
  detected?: BodyLandmarks;
}

export type AnalyseResult =
  | { kind: 'ready'; photo: PreparedPhoto; warnings: PoseProblem[] }
  /** Detection found nobody, or something that cannot be saved as it is. */
  | { kind: 'problems'; problems: PoseProblem[] }
  /** The detector itself failed (model could not be loaded, browser too old). */
  | { kind: 'failed' };

export const CANVAS_OUTPUT = { width: 1000, height: 2000, fill: colors.bg } as const;

/**
 * The 1:2 window covering a whole photo (centred; extra space is filled), for placing points by
 * hand when nothing was detected.
 */
export function wholePhotoWindow(width: number, height: number): PixelRect {
  const scale = Math.max(width / CANVAS_OUTPUT.width, height / CANVAS_OUTPUT.height);
  const w = CANVAS_OUTPUT.width * scale;
  const h = CANVAS_OUTPUT.height * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/** Manual placement: the photo as a whole, with the default body drawn into it. */
export async function placeByHand(
  photo: PickedPhoto,
  services: Pick<Services, 'bodyCrop'>,
): Promise<PreparedPhoto> {
  const window = wholePhotoWindow(photo.width, photo.height);
  const cropped = await services.bodyCrop.crop(photo.uri, window, CANVAS_OUTPUT);
  return { uri: cropped.uri, blob: cropped.blob, landmarks: defaultPhotoLandmarks() };
}

/**
 * Detect the person, crop to the canvas and move the landmarks into it (docs/TRY_ON.md §11.2–11.3).
 * When the detector is not available on this device the result is the manual-placement start.
 */
export async function analysePhoto(
  photo: PickedPhoto,
  services: PipelineServices,
  onProgress?: (fraction: number) => void,
): Promise<AnalyseResult> {
  if (!services.pose.available) {
    return { kind: 'ready', photo: await placeByHand(photo, services), warnings: [] };
  }
  let detection;
  try {
    await services.pose.prepare(onProgress);
    detection = await services.pose.detect(photo.uri);
  } catch {
    return { kind: 'failed' };
  }
  if (!detection) return { kind: 'problems', problems: ['no-person'] };
  const found = fromBlazePose(detection.keypoints, detection.width, detection.height);
  if (!found.landmarks) {
    return { kind: 'problems', problems: found.problems.length ? found.problems : ['no-person'] };
  }
  if (found.problems.some((p) => BLOCKING_POSE_PROBLEMS.includes(p))) {
    return { kind: 'problems', problems: found.problems };
  }
  const window = bodyCropWindow(found.landmarks);
  const cropped = await services.bodyCrop.crop(photo.uri, window, CANVAS_OUTPUT);
  const landmarks = toCanvas(found.landmarks, window);
  return {
    kind: 'ready',
    photo: { uri: cropped.uri, blob: cropped.blob, landmarks, detected: landmarks },
    warnings: found.problems,
  };
}
