import { loadDayFocus } from '../db/queries/streak';
import { dayKeyOf } from '../domain/day';
import { computeStreak, type StreakState } from '../domain/streak';
import { useAppStore } from './stores/app';

/**
 * The streak for code outside React: the reminder planner and the notification sync
 * read it when they build the day's plan (ADR-0027). Folds the sessions table at
 * call time and reads the grace rows from the store's cache.
 */
export function readStreak(now: number): StreakState {
  return computeStreak(loadDayFocus(now), useAppStore.getState().graceDays, dayKeyOf(now));
}
