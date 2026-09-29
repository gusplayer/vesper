/**
 * The target chips of the habit form: the offered targets plus the one already saved,
 * sorted, once each. Since ADR-0055 a habit and a challenge offer the same 1 to 6, so
 * every target this app saves has its chip; the saved one is kept for a target that
 * came from elsewhere — a challenge row the server accepts with any number — which
 * without its own chip would show nothing selected and be lost at the first tap. Pure.
 */
export function targetOptions(offered: readonly number[], saved: number | undefined): number[] {
  const all = saved === undefined || saved <= 0 ? [...offered] : [...offered, saved];
  return [...new Set(all)].sort((a, b) => a - b);
}
