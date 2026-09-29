import { MAX_HABITS, type DayKey, type Habit, type HabitMark, type HealthType, type WorkoutKind } from './types';

/**
 * Weekly habit progress. Counts, not time — a habit goal is "4 times this week", and
 * mixing it with the ledger's minutes would be adding two different currencies.
 *
 * Pure. Give it the habits and the marks of the week.
 */

/**
 * Offered weekly targets, the same as a challenge's (ADR-0055). 1 is "a ride a week";
 * 7 is not offered: the target counts days, and a day of rest is part of the plan.
 */
export const HABIT_TARGET_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
export const DEFAULT_HABIT_TARGET = 4;

type NamedWorkoutKind = Exclude<WorkoutKind, 'other'>;

/**
 * Words that ask for one kind of workout (ADR-0055), in both languages like
 * HEALTH_HINTS. A stem carries a boundary where it hides inside another word: 'nadar'
 * in "no hacer nada", 'cicla' in "reciclar", 'correr' in "recorrer", 'cycl' in
 * "recycle", 'bike' in "motorbike", 'spin' in "spinach", 'ride' in "pride", 'run' in
 * "brunch".
 */
const WORKOUT_KIND_HINTS: readonly { pattern: RegExp; kind: NamedWorkoutKind }[] = [
  {
    pattern:
      /bici|\bcicla|\bciclis|\brodar|\bpedal|\bspin(?:ning)?\b|\bmtb\b|\bbik(?:e|ing)|bicycl|\bcycl(?:e|ing|ist)|\brid(?:e|es|ing)\b/i,
    kind: 'cycling',
  },
  { pattern: /\bcorrer|\btrot|\brun(?:s|ning|ners?)?\b|\bjog/i, kind: 'running' },
  { pattern: /\bnadar|nataci|swim/i, kind: 'swimming' },
];

/** Words that ask for a workout of any kind. */
const ANY_WORKOUT_HINT = /gym|gimnas|entrena|pesas|ejercicio|workout|exercise|\btrain|weights|\blift/i;

/**
 * Names that map to a health type. Unlocks the verified count mode, which is what
 * ADR-0005 calls the right moment to ask for the health permission — not the
 * onboarding. First hint wins. Each pattern carries the Spanish and the English
 * words a user would name the habit with (ADR-0020); a name is data, so it is
 * matched in both languages whatever the app's language is.
 *
 * The workout pattern is built from the kinds' own, so a name that asks for a ride is
 * always a workout habit too.
 */
export const HEALTH_HINTS: readonly { pattern: RegExp; type: HealthType }[] = [
  {
    pattern: new RegExp(
      [ANY_WORKOUT_HINT, ...WORKOUT_KIND_HINTS.map((hint) => hint.pattern)].map((p) => p.source).join('|'),
      'i',
    ),
    type: 'workout',
  },
  { pattern: /camin|pasos|andar|senderis|walk|step|hike/i, type: 'steps' },
  { pattern: /dormir|sueño|sueno|sleep/i, type: 'sleep' },
];

export function healthTypeFor(name: string): HealthType | null {
  return HEALTH_HINTS.find((hint) => hint.pattern.test(name))?.type ?? null;
}

/**
 * The one kind of workout a workout habit's name asks for (ADR-0055), or null when it
 * takes any workout — or is not a workout habit at all; ask healthTypeFor first. The
 * kind is never stored: a challenge's name gives every participant the same one, like
 * the step goal (ADR-0042). First kind wins, cycling before running before swimming.
 */
export function workoutKindFor(name: string): NamedWorkoutKind | null {
  return WORKOUT_KIND_HINTS.find((hint) => hint.pattern.test(name))?.kind ?? null;
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
