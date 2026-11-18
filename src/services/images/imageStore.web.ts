import type { ID } from '@/core/model/types';
import { createIdGenerator } from '../system/ids';
import type { ImageStore } from '../types';
import { isUriSource, resolveImageId, type ImageStoreDeps } from './imageStoreShared';

export type { ImageStore } from '../types';
export type { ImageStoreDeps } from './imageStoreShared';

const DB_NAME = 'fashionable-images';
const STORE = 'images';

function request<R>(req: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function createImageStore(deps: ImageStoreDeps = {}): ImageStore {
  const ids = deps.ids ?? createIdGenerator();
  const urls = new Map<ID, string>();

  let dbPromise: Promise<IDBDatabase> | undefined;
  const db = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => {
        dbPromise = undefined;
        reject(open.error ?? new Error('Cannot open IndexedDB'));
      };
    });
    return dbPromise;
  };

  const revoke = (id: ID) => {
    const url = urls.get(id);
    if (url !== undefined) {
      URL.revokeObjectURL(url);
      urls.delete(id);
    }
  };

  return {
    async save(source, opts) {
      const blob = isUriSource(source) ? await (await fetch(source.uri)).blob() : source;
      const id = resolveImageId(ids, opts?.id);
      const tx = (await db()).transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      await transactionDone(tx);
      revoke(id); // the cached URL may point at the previous blob
      return id;
    },
    async uri(id) {
      const cached = urls.get(id);
      if (cached !== undefined) return cached;
      const blob = await request<Blob | undefined>(
        (await db()).transaction(STORE, 'readonly').objectStore(STORE).get(id),
      );
      if (!blob) throw new Error(`Unknown image id: ${id}`);
      const raced = urls.get(id);
      if (raced !== undefined) return raced;
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      return url;
    },
    async read(id) {
      const blob = await request<Blob | undefined>(
        (await db()).transaction(STORE, 'readonly').objectStore(STORE).get(id),
      );
      if (!blob) throw new Error(`Unknown image id: ${id}`);
      return blob;
    },
    async remove(id) {
      const tx = (await db()).transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      await transactionDone(tx);
      revoke(id);
    },
  };
}
