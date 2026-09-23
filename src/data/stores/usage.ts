import { create } from 'zustand';

import { USAGE } from '../seed';
import type { UsageReading } from '../types';

/**
 * The usage floor the activity tab, the life projection and the circle share read
 * (ADR-0004, ADR-0029). Not a cache of SQLite: the platform reads the phone on
 * demand and puts the result here; nothing is persisted. Until it does, or where it
 * cannot (iOS, no usage access, no real apps chosen), the demo estimate stands in
 * and `reason` says why, in the app's language.
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

  setDevice: (reading: UsageReading, now: number) => void;
  setDemo: (reason: string) => void;
};

export const useUsageStore = create<UsageState>((set) => ({
  source: 'demo',
  reason: null,
  reading: null,
  readAt: null,

  setDevice: (reading, now) => set({ source: 'device', reason: null, reading, readAt: now }),
  setDemo: (reason) => set({ source: 'demo', reason, reading: null, readAt: null }),
}));

/** This week's floor, from the phone when it answered and from the demo otherwise. */
export function weekUsageMs(state: Pick<UsageState, 'reading'>): number {
  return state.reading?.weekMs ?? USAGE.weekMs;
}
