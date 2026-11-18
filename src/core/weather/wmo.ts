/** WMO codes 0 (clear), 1 (mainly clear) and 2 (partly cloudy) count as sunny; 3+ does not. */
export function isSunnyCode(code: number | null | undefined): boolean {
  return typeof code === 'number' && Number.isFinite(code) && code >= 0 && code <= 2;
}
