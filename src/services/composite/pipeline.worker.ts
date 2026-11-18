import { compositeOutfit, type CompositeInput, type RGBAImage } from '@/core/composite';

/**
 * Worker entry: runs the pure compositing pipeline off the main thread (docs/TRY_ON.md §13.2).
 * The result's pixel buffer leaves as a transferred ArrayBuffer (no copy).
 */
export interface PipelineRequest {
  id: number;
  input: CompositeInput;
}

export type PipelineResponse =
  { id: number; ok: true; image: RGBAImage } | { id: number; ok: false; message: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<PipelineRequest>) => void) | null;
  postMessage(message: PipelineResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, input } = event.data;
  try {
    const image = compositeOutfit(input);
    scope.postMessage({ id, ok: true, image }, [image.data.buffer]);
  } catch (error) {
    scope.postMessage(
      { id, ok: false, message: error instanceof Error ? error.message : String(error) },
      [],
    );
  }
};
