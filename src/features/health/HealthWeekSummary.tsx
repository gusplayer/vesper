import { useMemo, useRef, useState } from 'react';

import { useAppStore, useSettings } from '../../data';
import { ListGroup, ListRow } from '../../design/components';
import { dayKeyOf, weekStart } from '../../domain/day';
import { healthTypeFor } from '../../domain/habits';
import type { Habit, HabitMark, HealthType } from '../../domain/types';
import type { Strings } from '../../i18n/es';
import { useLocale, useStrings } from '../../i18n';
import { clockText } from '../../lib/format';

type HealthWeekSummaryProps = {
  now: number;
  /** A row at the bottom that reads Health again. Resolves when the read is done. */
  onSyncNow: () => Promise<void>;
};

type Counts = Record<HealthType, number | null>;

/** One row per health type, in the order the page lists them. */
const ROWS: readonly HealthType[] = ['workout', 'steps', 'sleep'];

/**
 * What Health confirmed this week, counted from the marks it produced: distinct days
 * per health type. Null when no verified habit of that type exists, so the row says
 * so instead of showing a zero that means nothing.
 */
function countWeek(
  habits: readonly Habit[],
  habitMarks: readonly HabitMark[],
  now: number,
): Counts {
  const fromKey = dayKeyOf(weekStart(now));
  const toKey = dayKeyOf(now);
  const counts: Counts = { workout: null, steps: null, sleep: null };
  const typeByHabit = new Map<string, HealthType>();

  for (const habit of habits) {
    if (habit.archivedAt !== null || habit.countMode !== 'verified') {
      continue;
    }
    const type = habit.healthType ?? healthTypeFor(habit.name);
    if (type !== null) {
      typeByHabit.set(habit.id, type);
      counts[type] = counts[type] ?? 0;
    }
  }

  const days: Record<HealthType, Set<string>> = { workout: new Set(), steps: new Set(), sleep: new Set() };
  for (const mark of habitMarks) {
    const type = typeByHabit.get(mark.habitId);
    if (type !== undefined && mark.source === 'health' && mark.dayKey >= fromKey && mark.dayKey <= toKey) {
      days[type].add(mark.dayKey);
    }
  }
  for (const type of ROWS) {
    if (counts[type] !== null) {
      counts[type] = days[type].size;
    }
  }
  return counts;
}

/**
 * When Health was last read: the time alone when it was today, the day and the time
 * when it was not, so a read from last week does not pass for this afternoon's.
 */
function lastReadText(syncedAt: number, now: number, tag: string, t: Strings['habits']['healthWeek']): string {
  if (dayKeyOf(syncedAt) === dayKeyOf(now)) {
    return clockText(syncedAt);
  }
  const day = new Date(syncedAt).toLocaleDateString(tag, { day: 'numeric', month: 'short' });
  return t.lastReadOn(day, clockText(syncedAt));
}

/** The connected state of the Health page: counts, last sync, and a way to sync again. */
export function HealthWeekSummary({ now, onSyncNow }: HealthWeekSummaryProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const settings = useSettings();
  const [reading, setReading] = useState(false);
  // A ref as well: two taps in one frame both see `reading` false.
  const readingRef = useRef(false);

  const readNow = () => {
    if (readingRef.current) {
      return;
    }
    readingRef.current = true;
    setReading(true);
    void onSyncNow().finally(() => {
      readingRef.current = false;
      setReading(false);
    });
  };
  const habits = useAppStore((state) => state.habits);
  const marks = useAppStore((state) => state.habitMarks);
  const counts = useMemo(() => countWeek(habits, marks, now), [habits, marks, now]);
  const labels: Record<HealthType, string> = {
    workout: t.habits.healthWeek.workouts,
    steps: t.habits.healthWeek.stepDays,
    sleep: t.habits.healthWeek.nights,
  };

  return (
    <ListGroup title={t.habits.healthWeek.title}>
      {ROWS.map((type) => {
        const count = counts[type];
        return (
          <ListRow
            key={type}
            label={labels[type]}
            value={count === null ? t.habits.healthWeek.noHabit : String(count)}
          />
        );
      })}
      <ListRow
        label={t.habits.healthWeek.lastRead}
        value={
          settings.healthSyncedAt === null
            ? t.habits.healthWeek.notYet
            : lastReadText(settings.healthSyncedAt, now, tag, t.habits.healthWeek)
        }
      />
      <ListRow
        label={reading ? t.habits.healthWeek.reading : t.habits.healthWeek.readNow}
        kind="action"
        onPress={readNow}
        disabled={reading}
      />
    </ListGroup>
  );
}
