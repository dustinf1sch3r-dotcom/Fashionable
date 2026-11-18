import type { IdGenerator } from '../types';

interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** Formats 16 random bytes as a UUID v4 string. */
export function uuidFromBytes(bytes: ArrayLike<number>): string {
  const b = Array.from(bytes, (x) => x & 0xff);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map(hex).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * UUID v4. Uses `crypto.randomUUID` / `crypto.getRandomValues` when the runtime has them (all
 * browsers in secure contexts). React Native 0.88 / Hermes does not define a global `crypto`, so
 * native falls back to `Math.random`: fine for collision-free client IDs, not for secrets.
 */
export function createIdGenerator(source?: CryptoLike | undefined): IdGenerator {
  const c: CryptoLike | undefined =
    source ?? (globalThis as { crypto?: CryptoLike }).crypto ?? undefined;
  return {
    uuid(): string {
      if (c?.randomUUID) return c.randomUUID();
      const bytes = new Uint8Array(16);
      if (c?.getRandomValues) c.getRandomValues(bytes);
      else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      return uuidFromBytes(bytes);
    },
  };
}
