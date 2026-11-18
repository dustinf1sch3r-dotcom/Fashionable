import type { Entity, ID } from '@/core/model/types';
import type { Repository } from '@/services';

export const PERSIST_DELAY_MS = 250;

export interface Persister<T extends Entity> {
  /** Queue an insert or replace of `entity`; later changes to the same id supersede it. */
  put(entity: T): void;
  /** Queue a soft delete. */
  remove(id: ID): void;
  /** Write everything queued now (also what the debounce timer calls). */
  flush(): Promise<void>;
  /** Cancel the timer without writing. */
  dispose(): void;
}

type Op<T> = { kind: 'put'; entity: T } | { kind: 'remove' };

/**
 * Debounced write-behind queue for one repository. Only the latest operation per id is written,
 * so a burst of edits becomes one write per changed record. Failed writes stay queued for the next
 * flush and are reported through `onError`.
 */
export function createPersister<T extends Entity>(
  repo: Repository<T>,
  onError: (error: unknown) => void,
  onSuccess: () => void = () => undefined,
  delayMs: number = PERSIST_DELAY_MS,
): Persister<T> {
  let pending = new Map<ID, Op<T>>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tail: Promise<void> = Promise.resolve();

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, delayMs);
  }

  async function drain(): Promise<void> {
    const batch = pending;
    pending = new Map();
    let failed: unknown;
    let hasFailure = false;
    for (const [id, op] of batch) {
      try {
        if (op.kind === 'put') await repo.put(op.entity);
        else await repo.remove(id);
      } catch (error) {
        hasFailure = true;
        failed = error;
        if (!pending.has(id)) pending.set(id, op); // keep for retry unless superseded
      }
    }
    if (hasFailure) onError(failed);
    else if (batch.size > 0) onSuccess();
  }

  function flush(): Promise<void> {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    tail = tail.then(drain);
    return tail;
  }

  return {
    put(entity) {
      pending.set(entity.id, { kind: 'put', entity });
      schedule();
    },
    remove(id) {
      pending.set(id, { kind: 'remove' });
      schedule();
    },
    flush,
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
