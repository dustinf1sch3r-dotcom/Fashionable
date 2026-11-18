import { useSyncExternalStore } from 'react';

const subscribe = (): (() => void) => () => undefined;

/**
 * False while the static web page is rendered at build time and while the browser hydrates it,
 * true from the next render on (and always true on a phone). Use it for anything whose value
 * differs between the build machine and the device (is a canvas available, is a font loaded):
 * reading such a value during render makes the first client render differ from the prerendered
 * HTML, which React reports as hydration error #418.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
