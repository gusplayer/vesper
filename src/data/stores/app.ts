import { create } from 'zustand';

import { resolveActivityId } from '../../db/boot';
import { loadDayStats } from '../../db/queries/dayStats';
import { loadDayFocus } from '../../db/queries/streak';
import * as graceDaysRepo from '../../db/repositories/graceDays';
import * as habitsRepo from '../../db/repositories/habits';
import * as modesRepo from '../../db/repositories/modes';
import * as schedulesRepo from '../../db/repositories/schedules';
import * as settingsRepo from '../../db/repositories/settings';
import { dayKeyOf, shiftDayKey } from '../../domain/day';
import { refilled as refilledEmergency, spend as spendEmergency } from '../../domain/emergency';
import { activeHabitCount, canAddHabit } from '../../domain/habits';
import { graceDaysToApply, monthKeyOf } from '../../domain/streak';
import type { GraceDay, Habit, HabitMark } from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { SETTINGS } from '../seed';
import type { DayStat, Mode, NotificationPrefs, Rules, Schedule, Settings } from '../types';

/**
 * The prototype's whole world, cached in memory from SQLite. Every screen reads from
 * here through the hooks in src/data/index.ts and writes through these actions; each
 * action writes through its repository first, then updates the cache, so a relaunch
 * finds everything where it was (ADR-0017).
 *
 * Nothing is loaded until `hydrate()` runs. The root layout calls it, synchronously,
 * before the first render.
 */

/** How far back the day stats and the marks are loaded. A year is cheap and enough. */
const HISTORY_DAYS = 366;

type AppState = {
  modes: Mode[];
  activeModeId: string;
  schedules: Schedule[];
  settings: Settings;
  habits: Habit[];
  habitMarks: HabitMark[];
  dayStats: DayStat[];
  /** The days the streak was bridged on its own, oldest first (ADR-0027). */
  graceDays: GraceDay[];

  /** Reads everything from the database. Called once at boot and after a reset. */
  hydrate: (now?: number) => void;

  // Modes
  upsertMode: (
    mode: Omit<Mode, 'id' | 'createdAt' | 'selectionToken'> & { id?: string; selectionToken?: string | null },
  ) => Mode;
  duplicateMode: (id: string) => void;
  deleteMode: (id: string) => void;
  setActiveMode: (id: string) => void;
  /** Stores the native Screen Time selection for a mode. Null clears it. */
  setModeSelection: (id: string, selectionToken: string | null) => void;

  // Schedules
  /** Saves a schedule, stamped with now: a window already open at this instant will not start. */
  upsertSchedule: (schedule: Omit<Schedule, 'id' | 'updatedAt'> & { id?: string }) => Schedule;
  toggleSchedule: (id: string, enabled: boolean) => void;
  deleteSchedule: (id: string) => void;

  // Settings
  /**
   * Merges a patch. Ending the onboarding (`onboardingDone` false → true) also stamps
   * every schedule with that moment, so a demo routine whose window is open right
   * then waits for its next one instead of starting a session nobody asked for.
   */
  updateSettings: (patch: Partial<Settings>) => void;
  updateRules: (patch: Partial<Rules>) => void;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  useEmergency: () => void;
  dismissBanner: () => void;

  // Habits
  /**
   * Creates or edits a habit. False, and nothing written, when a new habit would be
   * the sixth active one: the screens refuse earlier, this is the rule holding on
   * its own (rule 4 in CLAUDE.md).
   */
  upsertHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archivedAt'> & { id?: string }) => boolean;
  archiveHabit: (id: string) => void;
  toggleHabitToday: (id: string, now: number) => void;
  /** Replaces every Health-sourced mark with what Health says now. Manual marks stay. */
  setHealthMarks: (marks: HabitMark[], syncedAt: number) => void;

  // Stats
  /**
   * Re-derives the day stats from the sessions table. The focus store calls it after
   * closing a session: the closed row is already in the database.
   */
  recordFocus: (now: number) => void;

  // Streak (ADR-0027)
  /**
   * Bridges the days since the last counted one with grace, while the month still
   * has some. Runs at boot and every time the app comes to the foreground, so the
   * streak is settled before any screen or reminder reads it.
   */
  settleStreak: (now: number) => void;
  /** Stamps the moment the app was opened, for the reactivation reminders. */
  markOpened: (now: number) => void;
};

function marksWindowFrom(now: number): string {
  return shiftDayKey(dayKeyOf(now), -HISTORY_DAYS);
}

export const useAppStore = create<AppState>((set, get) => {
  /** Writes the whole settings object and caches it. */
  const saveSettings = (settings: Settings): void => {
    settingsRepo.setPrototypeSettings(settings, Date.now());
    set({ settings });
  };

  const setActive = (id: string): void => {
    settingsRepo.setActiveModeId(id, Date.now());
    set({ activeModeId: id });
  };

  return {
    modes: [],
    activeModeId: '',
    schedules: [],
    settings: SETTINGS,
    habits: [],
    habitMarks: [],
    dayStats: [],
    graceDays: [],

    hydrate: (now = Date.now()) => {
      const modes = modesRepo.list();
      const stored = settingsRepo.getActiveModeId();
      const activeModeId =
        stored !== null && modes.some((m) => m.id === stored) ? stored : (modes[0]?.id ?? '');
      // The emergency budget is five a month, and a month may have turned over while
      // the app was closed (ADR-0025, and the condition ADR-0035 leans on).
      const stored_ = settingsRepo.getPrototypeSettings(SETTINGS);
      const budget = refilledEmergency(
        { left: stored_.emergencyLeft, total: stored_.emergencyTotal, monthKey: stored_.emergencyMonthKey },
        now,
      );
      const settings = {
        ...stored_,
        emergencyLeft: budget.left,
        emergencyTotal: budget.total,
        emergencyMonthKey: budget.monthKey,
      };
      if (budget.monthKey !== stored_.emergencyMonthKey) {
        settingsRepo.setPrototypeSettings(settings, now);
      }
      set({
        modes,
        activeModeId,
        schedules: schedulesRepo.list(),
        settings,
        habits: habitsRepo.listActive(),
        habitMarks: habitsRepo.listMarksBetween(marksWindowFrom(now), dayKeyOf(now)),
        dayStats: loadDayStats(now, HISTORY_DAYS),
        graceDays: graceDaysRepo.listGraceDays(),
      });
      // With the settings and the grace rows in, the days missed since the last open
      // get their grace before the first screen reads the streak.
      get().settleStreak(now);
    },

    upsertMode: (input) => {
      const existing = input.id === undefined ? undefined : get().modes.find((m) => m.id === input.id);
      const mode: Mode = {
        ...input,
        id: existing?.id ?? uuidv7(Date.now()),
        createdAt: existing?.createdAt ?? Date.now(),
        // Null clears the selection on purpose; only an absent field keeps the old one.
        selectionToken:
          input.selectionToken === undefined ? (existing?.selectionToken ?? null) : input.selectionToken,
      };
      modesRepo.upsert(mode);
      const wasEmpty = get().modes.length === 0;
      set((state) => ({
        modes: existing
          ? state.modes.map((m) => (m.id === mode.id ? mode : m))
          : [...state.modes, mode],
      }));
      if (wasEmpty) {
        setActive(mode.id);
      }
      return mode;
    },

    duplicateMode: (id) => {
      const source = get().modes.find((m) => m.id === id);
      if (source === undefined) {
        return;
      }
      const copy: Mode = { ...source, id: uuidv7(Date.now()), name: `${source.name} (1)`, createdAt: Date.now() };
      modesRepo.upsert(copy);
      set((state) => {
        const index = state.modes.findIndex((m) => m.id === id);
        const modes = [...state.modes];
        modes.splice(index + 1, 0, copy);
        return { modes };
      });
    },

    deleteMode: (id) => {
      const now = Date.now();
      modesRepo.remove(id);
      // Schedules using this mode are turned off, like Brick warns.
      schedulesRepo.disableByMode(id, now);
      const modes = get().modes.filter((m) => m.id !== id);
      set((state) => ({
        modes,
        schedules: state.schedules.map((s) => (s.modeId === id ? { ...s, enabled: false, updatedAt: now } : s)),
      }));
      if (get().activeModeId === id) {
        setActive(modes[0]?.id ?? '');
      }
    },

    setActiveMode: (id) => setActive(id),

    setModeSelection: (id, selectionToken) => {
      modesRepo.setSelectionToken(id, selectionToken);
      set((state) => ({ modes: state.modes.map((m) => (m.id === id ? { ...m, selectionToken } : m)) }));
    },

    upsertSchedule: (input) => {
      const now = Date.now();
      const schedule: Schedule = { ...input, id: input.id ?? uuidv7(now), updatedAt: now };
      schedulesRepo.upsert(schedule, now);
      set((state) => ({
        schedules: state.schedules.some((s) => s.id === schedule.id)
          ? state.schedules.map((s) => (s.id === schedule.id ? schedule : s))
          : [...state.schedules, schedule],
      }));
      return schedule;
    },

    toggleSchedule: (id, enabled) => {
      const now = Date.now();
      schedulesRepo.setEnabled(id, enabled, now);
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? { ...s, enabled, updatedAt: now } : s)),
      }));
    },

    deleteSchedule: (id) => {
      schedulesRepo.remove(id);
      set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) }));
    },

    updateSettings: (patch) => {
      const current = get().settings;
      if (patch.onboardingDone === true && !current.onboardingDone) {
        const now = Date.now();
        schedulesRepo.touchAll(now);
        set((state) => ({ schedules: state.schedules.map((s) => ({ ...s, updatedAt: now })) }));
      }
      saveSettings({ ...current, ...patch });
    },

    updateRules: (patch) => {
      const current = get().settings;
      saveSettings({ ...current, rules: { ...current.rules, ...patch } });
    },

    updateNotifications: (patch) => {
      const current = get().settings;
      saveSettings({ ...current, notifications: { ...current.notifications, ...patch } });
    },

    useEmergency: () => {
      const current = get().settings;
      const budget = spendEmergency(
        { left: current.emergencyLeft, total: current.emergencyTotal, monthKey: current.emergencyMonthKey },
        Date.now(),
      );
      saveSettings({
        ...current,
        emergencyLeft: budget.left,
        emergencyTotal: budget.total,
        emergencyMonthKey: budget.monthKey,
      });
    },

    dismissBanner: () => saveSettings({ ...get().settings, pendingBanner: null }),

    upsertHabit: (input) => {
      const existing = input.id === undefined ? undefined : get().habits.find((h) => h.id === input.id);
      const becomesActive = existing === undefined || existing.archivedAt !== null;
      if (becomesActive && !canAddHabit(activeHabitCount(get().habits))) {
        return false;
      }
      const habit: Habit = {
        ...input,
        // The editor speaks in activity keys; the habits table holds the row id.
        activityId: input.activityId === null ? null : resolveActivityId(input.activityId),
        id: existing?.id ?? uuidv7(Date.now()),
        createdAt: existing?.createdAt ?? Date.now(),
        archivedAt: null,
      };
      habitsRepo.upsert(habit);
      set((state) => ({
        habits: existing
          ? state.habits.map((h) => (h.id === habit.id ? habit : h))
          : [...state.habits, habit],
      }));
      return true;
    },

    archiveHabit: (id) => {
      const now = Date.now();
      habitsRepo.archive(id, now);
      set((state) => ({
        habits: state.habits.map((h) => (h.id === id ? { ...h, archivedAt: now } : h)),
      }));
    },

    toggleHabitToday: (id, now) => {
      const dayKey = dayKeyOf(now);
      const existing = get().habitMarks.find(
        (m) => m.habitId === id && m.dayKey === dayKey && m.source !== 'health',
      );
      if (existing !== undefined) {
        habitsRepo.unmarkManual(id, dayKey);
        set((state) => ({ habitMarks: state.habitMarks.filter((m) => m !== existing) }));
        return;
      }
      habitsRepo.mark({ habitId: id, dayKey, source: 'manual' }, now);
      // Re-read: the repository generated the id and INSERT OR IGNORE may have kept
      // a row this cache did not know about.
      set({ habitMarks: habitsRepo.listMarksBetween(marksWindowFrom(now), dayKey) });
    },

    setHealthMarks: (marks, syncedAt) => {
      habitsRepo.replaceHealthMarks(marks);
      set((state) => ({
        habitMarks: [...state.habitMarks.filter((m) => m.source !== 'health'), ...marks],
      }));
      saveSettings({ ...get().settings, healthSyncedAt: syncedAt });
    },

    recordFocus: (now) => set({ dayStats: loadDayStats(now, HISTORY_DAYS) }),

    settleStreak: (now) => {
      const toApply = graceDaysToApply(loadDayFocus(now), get().graceDays, dayKeyOf(now));
      if (toApply.length === 0) {
        return;
      }
      for (const dayKey of toApply) {
        graceDaysRepo.insertGraceDay({ dayKey, monthKey: monthKeyOf(dayKey), createdAt: now });
      }
      // Re-read: INSERT OR IGNORE may have kept a row this cache did not know about.
      set({ graceDays: graceDaysRepo.listGraceDays() });
    },

    markOpened: (now) => saveSettings({ ...get().settings, lastOpenedAt: now }),
  };
});
