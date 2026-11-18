import type { CutoutCrop } from '@/core/model/types';
import type { TouchupResult } from '@/services';

export interface CutoutEditorProps {
  /** The stored original photo; "Restore" paints pixels back from it. */
  originalUri: string;
  /** The current cutout; without one the whole photo starts as kept. */
  cutoutUri?: string;
  /** Where the cutout sits in the original photo, when recorded; else it is searched for. */
  crop?: CutoutCrop;
  onCancel: () => void;
  onDone: (result: TouchupResult) => void;
}
