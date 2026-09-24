import { MAX_HABITS, type DayKey, type Habit, type HabitMark, type HealthType } from './types';

/**
 * Weekly habit progress. Counts, not time — a habit goal is "4 times this week", and
 * mixing it with the ledger's minutes would be adding two different currencies.
 *
 * Pure. Give it the habits and the marks of the week.
 */

/** Offered weekly targets. No custom value in phase 1 — docs/SPRINT_01.md. */
export const HABIT_TARGET_OPTIONS = [2, 4, 6] as const;
export const DEFAULT_HABIT_TARGET = 4;

/**
 * Names that map to a health type. Unlocks the verified count mode, which is what
 * ADR-0005 calls the right moment to ask for the health permission — not the
 * onboarding. First hint wins. Each pattern carries the Spanish and the English
 * words a user would name the habit with (ADR-0020); a name is data, so it is
 * matched in both languages whatever the app's language is.
 */
export const HEALTH_HINTS: readonly { pattern: RegExp; type: HealthType }[] = [
  {
    pattern: /gym|entrena|pesas|ejercicio|correr|bici|workout|exercise|\btrain|weights|\blift|\brun|\bjog|bike|cycl|swim/i,
    type: 'workout',
  },
  { pattern: /camin|pasos|andar|walk|step|hike/i, type: 'steps' },
  { pattern: /dormir|sueño|sueno|sleep/i, type: 'sleep' },
];

export function healthTypeFor(name: string): HealthType | null {
  return HEALTH_HINTS.find((hint) => hint.pattern.test(name))?.type ?? null;
}

/**
 * A habit is only Health's to mark when Health is connected and can actually
 * recognise it; then a tap would put a declared mark where the verified one belongs
 * (ADR-0005), so no screen offers one. Asking for the type too rescues the rows saved
 * as verified before ADR-0041 for a name nothing maps to: those still take a tap.
 */
export function isMarkedByHealth(
  habit: Pick<Habit, 'countMode' | 'healthType' | 'name'>,
  healthConnected: boolean,
): boolean {
  return healthConnected && habit.countMode === 'verified' && (habit.healthType ?? healthTypeFor(habit.name)) !== null;
}

/**
 * Whether one more active habit fits under the cap (rule 4 in CLAUDE.md, invariant 3
 * in DATA_MODEL.md). The one place the comparison is written: the repository, the
 * stores and the screens all ask this instead of comparing against MAX_HABITS.
 */
export function canAddHabit(activeCount: number): boolean {
  return activeCount < MAX_HABITS;
}

/** How many active habits a list holds: archived ones do not take a slot. */
export function activeHabitCount(habits: readonly Pick<Habit, 'archivedAt'>[]): number {
  return habits.filter((habit) => habit.archivedAt === null).length;
}

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
function markedDaysOf(marks: readonly HabitMark[], habitId: string): number {
  const days = new Set<DayKey>();
  for (const mark of marks) {
    if (mark.habitId === habitId) {
      days.add(mark.dayKey);
    }
  }
  return days.size;
}

export function isMarkedOn(
  marks: readonly HabitMark[],
  habitId: string,
  dayKey: DayKey,
): boolean {
  return marks.some((mark) => mark.habitId === habitId && mark.dayKey === dayKey);
}

export function weeklyProgress(
  habits: readonly Habit[],
  weekMarks: readonly HabitMark[],
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
