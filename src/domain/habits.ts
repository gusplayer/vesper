import type { DayKey, Habit, HabitMark } from './types';

/**
 * Weekly habit progress. Counts, not time — a habit goal is "4 times this week", and
 * mixing it with the ledger's minutes would be adding two different currencies.
 *
 * Pure. Give it the habits and the marks of the week.
 */

export type HabitProgress = {
  habit: Habit;
  /** Distinct days marked this week. */
  markedDays: number;
  /** True once the weekly target is met. Communicated with a word, never a color. */
  met: boolean;
  /** Whether today already counts, so the UI knows if a tap marks or unmarks. */
  markedToday: boolean;
};

/**
 * Distinct days, not marks: a day with both a health sample and a manual tap counts
 * once. Without that, a synced habit would race past its target.
 */
function markedDaysOf(marks: HabitMark[], habitId: string): number {
  const days = new Set<DayKey>();
  for (const mark of marks) {
    if (mark.habitId === habitId) {
      days.add(mark.dayKey);
    }
  }
  return days.size;
}

export function isMarkedOn(marks: HabitMark[], habitId: string, dayKey: DayKey): boolean {
  return marks.some((mark) => mark.habitId === habitId && mark.dayKey === dayKey);
}

export function weeklyProgress(
  habits: Habit[],
  weekMarks: HabitMark[],
  todayKey: DayKey,
): HabitProgress[] {
  return habits.map((habit) => {
    const markedDays = markedDaysOf(weekMarks, habit.id);
    return {
      habit,
      markedDays,
      met: markedDays >= habit.weeklyTarget,
      markedToday: isMarkedOn(weekMarks, habit.id, todayKey),
    };
  });
}
