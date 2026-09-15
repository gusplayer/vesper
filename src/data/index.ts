import { useMemo } from 'react';

import { dayBounds, dayKeyOf, weekStart } from '../domain/day';
import { weeklyProgress, type HabitProgress } from '../domain/habits';
import { weeksLived, weeksRemaining, weeksTotal } from '../domain/life';
import { DAY } from '../domain/time';
import { weekProgress, type WeekProgress } from '../domain/week';
import { ACTIVITIES, APPS, HEALTH, MODE_IDEAS, USAGE, WEBSITES } from './seed';
import { useAppStore } from './stores/app';
import { useFocusStore } from './stores/focus';
import type { AppInfo, DayStat, Mode, Schedule, Website } from './types';

/**
 * The hooks screens use. Each answers one question a screen has, in the shape the
 * screen wants. This is the seam: when real data arrives, these hooks keep their
 * signatures and the stores behind them change (ADR-0016).
 */

export { useAppStore, useFocusStore };
export { ACTIVITIES, APPS, MODE_IDEAS, WEBSITES, HEALTH, USAGE };

export function useApps(): AppInfo[] {
  return APPS;
}

export function appsById(ids: ReadonlyArray<string>): AppInfo[] {
  return ids.map((id) => APPS.find((app) => app.id === id)).filter((app): app is AppInfo => app !== undefined);
}

export function websitesById(ids: ReadonlyArray<string>): Website[] {
  return ids.map((id) => WEBSITES.find((site) => site.id === id)).filter((site): site is Website => site !== undefined);
}

export function useModes(): Mode[] {
  return useAppStore((state) => state.modes);
}

export function useMode(id: string | undefined): Mode | null {
  return useAppStore((state) => state.modes.find((mode) => mode.id === id) ?? null);
}

export function useActiveMode(): Mode | null {
  return useAppStore((state) => state.modes.find((mode) => mode.id === state.activeModeId) ?? null);
}

export function useSchedules(): Schedule[] {
  return useAppStore((state) => state.schedules);
}

export function useSettings() {
  return useAppStore((state) => state.settings);
}

export function useRunningSession() {
  return useFocusStore((state) => state.session);
}

/** Today's focus so far, running session included, for the counter on the home page. */
export function useTodayFocusMs(now: number): number {
  const stats = useAppStore((state) => state.dayStats);
  const session = useFocusStore((state) => state.session);
  const today = stats.find((d) => d.dayKey === dayKeyOf(now));
  const live = session === null ? 0 : Math.min(now - session.startedAt, session.plannedMs);
  return (today?.focusMs ?? 0) + Math.max(0, live);
}

export function useDayStats(): DayStat[] {
  return useAppStore((state) => state.dayStats);
}

/** The seven days of the week containing `now`, Monday first; future days have zero. */
export function useWeekStats(now: number): DayStat[] {
  const stats = useDayStats();
  return useMemo(() => {
    const start = weekStart(now);
    return Array.from({ length: 7 }, (_, i) => {
      const dayKey = dayKeyOf(start + i * DAY);
      return stats.find((d) => d.dayKey === dayKey) ?? { dayKey, focusMs: 0, sessions: 0, segments: [] };
    });
  }, [stats, now]);
}

export function useWeekProgress(now: number): WeekProgress {
  const week = useWeekStats(now);
  const target = useAppStore((state) => state.settings.weeklyTargetMs);
  return useMemo(() => {
    const focusMs = week.reduce((total, day) => total + day.focusMs, 0);
    // weekProgress wants sessions; the prototype has day totals. Same arithmetic.
    const base = weekProgress([], target, now);
    return { ...base, focusMs, met: base.targetMs !== null && focusMs >= base.targetMs };
  }, [week, target, now]);
}

export function useHabitsWeek(now: number): HabitProgress[] {
  const habits = useAppStore((state) => state.habits);
  const marks = useAppStore((state) => state.habitMarks);
  return useMemo(() => {
    const active = habits.filter((h) => h.archivedAt === null);
    const fromKey = dayKeyOf(weekStart(now));
    const todayKey = dayKeyOf(now);
    const weekMarks = marks.filter((m) => m.dayKey >= fromKey && m.dayKey <= todayKey);
    return weeklyProgress(active, weekMarks, todayKey);
  }, [habits, marks, now]);
}

export function useLife(now: number) {
  const settings = useSettings();
  return useMemo(() => {
    if (settings.birthDate === null) {
      return null;
    }
    return {
      lived: weeksLived(settings.birthDate, now),
      total: weeksTotal(settings.lifeExpectancyYears),
      left: weeksRemaining(settings.birthDate, settings.lifeExpectancyYears, now),
    };
  }, [settings.birthDate, settings.lifeExpectancyYears, now]);
}

/** The window of today, for anything that clips to the day. */
export function todayBounds(now: number) {
  return dayBounds(now);
}
