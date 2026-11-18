/**
 * Downloads for the pose model and runtime: bytes with progress, kept in the browser's Cache API
 * for later visits. (Same approach as the cutout model, docs/ARCHITECTURE.md.)
 */
const CACHE_NAME = 'fashionable-pose-v1';

export type Progress = (fraction: number) => void;

async function openCache(): Promise<Cache | undefined> {
  try {
    return typeof caches === 'undefined' ? undefined : await caches.open(CACHE_NAME);
  } catch {
    return undefined; // private mode or blocked storage: download every time
  }
}

export async function fetchBytes(url: string, onFraction: Progress): Promise<ArrayBuffer> {
  const cache = await openCache();
  try {
    const hit = await cache?.match(url);
    if (hit) {
      const bytes = await hit.arrayBuffer();
      onFraction(1);
      return bytes;
    }
  } catch {
    // Fall through to the network.
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  // Some hosts answer a missing file with index.html: refuse to use (or cache) that.
  if ((response.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`Not a binary file: ${url}`);
  }
  const total = Number(response.headers.get('content-length')) || 0;
  let bytes: ArrayBuffer;
  if (response.body && total > 0) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onFraction(Math.min(1, received / total));
    }
    const joined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    bytes = joined.buffer;
  } else {
    bytes = await response.arrayBuffer();
  }
  onFraction(1);
  try {
    await cache?.put(url, new Response(bytes.slice(0)));
  } catch {
    // Quota exceeded: still usable this session.
  }
  return bytes;
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
}
