import { create } from 'zustand';

import type { UsageReading } from '../types';

/**
 * The usage floor the activity tab, the life projection and the circle share read
 * (ADR-0004, ADR-0029). Not a cache of SQLite: the platform reads the phone on
 * demand and puts the result here; nothing is persisted. Until it does, or where it
 * cannot (iOS, no usage access, no real apps chosen, a read that failed), the demo
 * estimate stands in and `reason` says why, in the app's language.
 */

export type UsageSource = 'demo' | 'device';

type UsageState = {
  source: UsageSource;
  /** Why the phone gives nothing. Null while it does, and before the first read. */
  reason: string | null;
  /** The last device reading; null while the demo stands in. */
  reading: UsageReading | null;
  /** When the phone was last read, epoch ms. */
  readAt: number | null;
  /**
   * Bumped by `reset` alone. The platform sync watches it to drop its own cooldown:
   * this store has no SQLite to rehydrate from, so the reset has to be announced.
   */
  epoch: number;

  setDevice: (reading: UsageReading, now: number) => void;
  setDemo: (reason: string) => void;
  reset: () => void;
};

const EMPTY = { source: 'demo', reason: null, reading: null, readAt: null } as const;

export const useUsageStore = create<UsageState>((set) => ({
  ...EMPTY,
  epoch: 0,

  setDevice: (reading, now) => set({ source: 'device', reason: null, reading, readAt: now }),
  setDemo: (reason) => set({ ...EMPTY, reason }),
  /** "Borrar todo y reiniciar": the phone's reading is data too, and it goes. */
  reset: () => set((state) => ({ ...EMPTY, epoch: state.epoch + 1 })),
}));

/**
 * This week's floor as it may leave the phone, or null when there is nothing of the
 * user's own to share. The demo floor is 11 h 40 min of seed data, and on iOS it is
 * what stands in *always*: publishing it to the circle would be an invented figure
 * presented as someone's real week. Null means "not shared", never zero (ADR-0033);
 * the toggle decides whether to share, the source decides whether there is anything
 * to share (ADR-0035 §2). The activity tab still shows the estimate, with its note
 * (ADR-0029 §3, ADR-0035 §3).
 */
export function sharedWeekUsageMs(state: Pick<UsageState, 'source' | 'reading'>): number | null {
  return state.source === 'device' ? (state.reading?.weekMs ?? null) : null;
}
