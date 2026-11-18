import type { TouchupResult } from '@/services';

export interface CutoutEditorProps {
  /** The stored original photo; "Restore" paints pixels back from it. */
  originalUri: string;
  /** The current cutout; without one the whole photo starts as kept. */
  cutoutUri?: string;
  onCancel: () => void;
  onDone: (result: TouchupResult) => void;
}
