/**
 * A counter per key and per window, in memory.
 *
 * **In memory on purpose, and only honest while the service is one process.** The circle
 * API runs as a single Railway instance (see `server/README.md`); if it ever runs on two
 * replicas, each one keeps its own counts and every limit here doubles. The day that
 * happens the counters move to Postgres or to Redis — they do not quietly become wrong.
 *
 * Fixed windows, not a sliding one: a caller can spend one window's budget at its end
 * and the next one's at its start, so the real worst case is twice the limit over a short
 * spell. For guessing a six-symbol code out of an alphabet of 32 that changes nothing.
 */

export type RateLimiter = {
  /** True when the call fits in the budget, false when it is over. Counts the call. */
  take(key: string, limit: number, windowMs: number): boolean;
  /** For tests and for a caller that decided not to spend its allowance after all. */
  refund(key: string): void;
};

/** Enough for a small circle app; beyond it the oldest expired windows are dropped. */
const MAX_KEYS = 20_000;

export function createRateLimiter(now: () => number): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const prune = (at: number): void => {
    for (const [key, window] of windows) {
      if (window.resetAt <= at) {
        windows.delete(key);
      }
    }
    if (windows.size > MAX_KEYS) {
      // Nothing expired and the map is still too big: an attacker is minting keys. Drop
      // everything rather than grow without a bound — the cost is that honest callers
      // get their budget back, which is the safe direction to fail.
      windows.clear();
    }
  };

  return {
    take(key, limit, windowMs) {
      const at = now();
      const window = windows.get(key);
      if (window === undefined || window.resetAt <= at) {
        if (windows.size >= MAX_KEYS) {
          prune(at);
        }
        windows.set(key, { count: 1, resetAt: at + windowMs });
        return true;
      }
      if (window.count >= limit) {
        return false;
      }
      window.count += 1;
      return true;
    },
    refund(key) {
      const window = windows.get(key);
      if (window !== undefined && window.count > 0) {
        window.count -= 1;
      }
    },
  };
}
