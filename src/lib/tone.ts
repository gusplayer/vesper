import type { HabitProgress } from '../domain/habits';
import type { LedgerRow } from '../domain/types';

/**
 * How loudly a row speaks. Tone follows provenance, never outcome: verified time is
 * strong because Health confirmed it, and "done" is a word, not a bolder row.
 */
export type Tone = 'strong' | 'normal' | 'faint';

/** Verified time is celebrated, unregistered time whispers. Never a color. */
export function ledgerTone(row: LedgerRow): Tone {
  if (row.provenance === 'verified') {
    return 'strong';
  }
  return row.provenance === 'unknown' ? 'faint' : 'normal';
}

export function habitTone(progress: HabitProgress): Tone {
  return progress.habit.countMode === 'verified' ? 'strong' : 'normal';
}
