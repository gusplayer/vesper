import { useMemo } from 'react';

import { dayBounds, dayKeyOf, weekStart } from '../domain/day';
import { weeklyProgress, type HabitProgress } from '../domain/habits';
import { weeksLived, weeksRemaining, weeksTotal } from '../domain/life';
import { DAY } from '../domain/time';
import { weekProgress, type WeekProgress } from '../domain/week';
import { bootDatabase, resetDatabase, type BootResult } from '../db/boot';
import { getStrings, stringsFor, useStrings, type Strings } from '../i18n';
import { freshInstallLocale, useLocaleStore } from '../i18n/store';
import { useOnboardingDraft } from './onboardingDraft';
import { demoActivities, demoApps, demoModeIdeas, HEALTH, USAGE, WEBSITES } from './seed';
import { useAppStore } from './stores/app';
import { useFocusStore } from './stores/focus';
import type { Activity, AppInfo, DayStat, Mode, ModeIdea, Schedule, Website } from './types';

/**
 * The hooks screens use. Each answers one question a screen has, in the shape the
 * screen wants. This is the seam: the hooks kept their signatures when the stores
 * behind them moved from seeded memory to SQLite (ADR-0016, ADR-0017).
 */

export { useAppStore, useFocusStore };
export { WEBSITES, HEALTH, USAGE };

/**
 * The catalogues with words in them (apps, activities, mode ideas) follow the current
 * language (ADR-0020). Built once per language: the dictionary slices are stable
 * objects, so the arrays are too, and a screen can key effects on them.
 */
function perLanguage<T>(build: (demo: Strings['demo']) => T): (demo: Strings['demo']) => T {
  const cache = new WeakMap<Strings['demo'], T>();
  return (demo) => {
    const hit = cache.get(demo);
    if (hit !== undefined) {
      return hit;
    }
    const built = build(demo);
    cache.set(demo, built);
    return built;
  };
}

const appsFor = perLanguage(demoApps);
const activitiesFor = perLanguage(demoActivities);
const modeIdeasFor = perLanguage(demoModeIdeas);

/** Reads the whole database into both stores. Synchronous: op-sqlite is. */
function hydrateStores(now: number): void {
  useLocaleStore.getState().hydrate();
  useAppStore.getState().hydrate(now);
  useFocusStore.getState().hydrate();
}

/**
 * Opens and migrates the database, seeds it when empty, and fills the stores, all
 * before the first render. Throws on failure; the root layout shows FatalError.
 */
export function bootAndHydrate(now: number): BootResult {
  const result = bootDatabase(now, stringsFor(freshInstallLocale()).demo);
  hydrateStores(now);
  return result;
}

/**
 * "Borrar todo y reiniciar": empties every table, reseeds the demo data and refills
 * the stores. With `onboardingDone` back to false the root layout's guard sends the
 * user through onboarding again, so its draft is cleared too.
 */
export function resetAndRehydrate(now: number): BootResult {
  // The language survives the reset: it was a deliberate choice, not data, and the
  // demo data is written in the language the app is showing right now (ADR-0020).
  const { preference, locale } = useLocaleStore.getState();
  const result = resetDatabase(now, stringsFor(locale).demo);
  if (preference !== 'auto') {
    useLocaleStore.getState().setPreference(preference, now);
  }
  useOnboardingDraft.getState().reset();
  hydrateStores(now);
  return result;
}

export function useApps(): AppInfo[] {
  return appsFor(useStrings().demo);
}

/** For code outside React. Reads the language at call time. */
export function getApps(): AppInfo[] {
  return appsFor(getStrings().demo);
}

export function useActivities(): Activity[] {
  return activitiesFor(useStrings().demo);
}

export function getActivities(): Activity[] {
  return activitiesFor(getStrings().demo);
}

export function useModeIdeas(): ModeIdea[] {
  return modeIdeasFor(useStrings().demo);
}

export function getModeIdeas(): ModeIdea[] {
  return modeIdeasFor(getStrings().demo);
}

export function appsById(ids: ReadonlyArray<string>): AppInfo[] {
  const apps = getApps();
  return ids.map((id) => apps.find((app) => app.id === id)).filter((app): app is AppInfo => app !== undefined);
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
