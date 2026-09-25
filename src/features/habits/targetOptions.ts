/**
 * The target chips of the habit form: the offered targets plus the one already saved,
 * sorted, once each. A habit can carry a target the chips do not offer — the demo's
 * "Dormir" has 5, and a habit a challenge created takes the challenge's 2 to 6
 * (data/stores/circle.ts) — and without its own chip it would show nothing selected
 * and be lost at the first tap. Pure.
 */
export function targetOptions(offered: readonly number[], saved: number | undefined): number[] {
  const all = saved === undefined || saved <= 0 ? [...offered] : [...offered, saved];
  return [...new Set(all)].sort((a, b) => a - b);
}
