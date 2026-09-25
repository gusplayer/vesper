import { create } from 'zustand';

import { resolveActivityId } from '../../db/boot';
import { loadDayStats } from '../../db/queries/dayStats';
import { loadLedgerSources, type LedgerSources } from '../../db/queries/dayLedger';
import { EMPTY_LIFETIME, loadLifetimeTotals, type LifetimeTotals } from '../../db/queries/lifetime';
import { loadDayFocus } from '../../db/queries/streak';
import * as graceDaysRepo from '../../db/repositories/graceDays';
import * as habitsRepo from '../../db/repositories/habits';
import * as modesRepo from '../../db/repositories/modes';
import * as schedulesRepo from '../../db/repositories/schedules';
import * as demoRepo from '../../db/repositories/demo';
import * as settingsRepo from '../../db/repositories/settings';
import { dayKeyOf, shiftDayKey } from '../../domain/day';
import { activeHabitCount, canAddHabit } from '../../domain/habits';
import { graceDaysToApply, monthKeyOf, STREAK_WINDOW_DAYS } from '../../domain/streak';
import type { DayKey, GraceDay, Habit, HabitMark } from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import { settledEmergency } from '../emergency';
import { SEEDED_IDS } from '../seededIds';
import { duplicateName } from '../modes';
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

/**
 * How far back the day stats and the marks are loaded. It is the streak's window
 * (domain/streak) on purpose: Focus reads the streak from these day stats and the
 * reminder planner reads it from `loadDayFocus`, and `computeStreak` stops at the edge
 * of the window it is given, so two spans would be two different numbers on the same
 * phone. A year and a bit is cheap either way.
 */
const HISTORY_DAYS = STREAK_WINDOW_DAYS;

type AppState = {
  modes: Mode[];
  activeModeId: string;
  schedules: Schedule[];
  settings: Settings;
  habits: Habit[];
  habitMarks: HabitMark[];
  dayStats: DayStat[];
  /** Every closed session ever, folded: the lifetime cards outgrow `dayStats`' window. */
  lifetime: LifetimeTotals;
  /**
   * Seeded sample data is still on the phone (ADR-0047 §1): Focus and Actividad say so,
   * and Ajustes offers to remove it.
   */
  hasDemoData: boolean;
  /** Today's sessions and their activities, for the day ledger (ADR-0038). */
  ledger: LedgerSources;
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
  /** Spends one emergency unlock of this month, after the month's refill is settled. */
  useEmergency: () => void;
  /**
   * Fills the emergency count again when a new month has begun (ADR-0025: five a
   * month). Runs at boot and should run on every return to the foreground.
   */
  settleEmergency: (now: number) => void;
  /**
   * "Quitar los datos de ejemplo" (ADR-0047 §1): deletes only what the seed wrote
   * (`SEEDED_IDS`), then re-reads everything so every cache and `hasDemoData` agree.
   * The circle's cache is refreshed by the caller (`src/data/demoData.ts`): this store
   * cannot import the circle's without a cycle.
   */
  removeDemoData: (now: number) => void;

  // Habits
  /**
   * Creates or edits a habit. False, and nothing written, when a new habit would be
   * the sixth active one: the screens refuse earlier, this is the rule holding on
   * its own (rule 4 in CLAUDE.md).
   */
  upsertHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archivedAt'> & { id?: string }) => boolean;
  archiveHabit: (id: string) => void;
  toggleHabitToday: (id: string, now: number) => void;
  /**
   * Replaces the Health-sourced marks of the window a read covered with what Health
   * says now; without a window, all of them (disconnecting). Manual marks stay.
   */
  setHealthMarks: (marks: HabitMark[], syncedAt: number, window?: { fromKey: DayKey; toKey: DayKey }) => void;

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

/** Takes a mode off the restore's repick list (ADR-0048 §9). */
function forgetRepick(id: string, now: number): void {
  const ids = settingsRepo.getModesRepick();
  if (ids.includes(id)) {
    settingsRepo.setModesRepick(
      ids.filter((other) => other !== id),
      now,
    );
  }
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
    lifetime: EMPTY_LIFETIME,
    hasDemoData: false,
    ledger: { sessions: [], activities: [] },
    graceDays: [],

    hydrate: (now = Date.now()) => {
      const repick = new Set(settingsRepo.getModesRepick());
      const modes = modesRepo.list().map((m) => (repick.has(m.id) ? { ...m, needsRepick: true } : m));
      const stored = settingsRepo.getActiveModeId();
      const activeModeId =
        stored !== null && modes.some((m) => m.id === stored) ? stored : (modes[0]?.id ?? '');
      set({
        modes,
        activeModeId,
        schedules: schedulesRepo.list(),
        settings: settingsRepo.getPrototypeSettings(SETTINGS),
        habits: habitsRepo.listActive(),
        habitMarks: habitsRepo.listMarksBetween(marksWindowFrom(now), dayKeyOf(now)),
        dayStats: loadDayStats(now, HISTORY_DAYS),
        lifetime: loadLifetimeTotals(now),
        hasDemoData: demoRepo.hasSeeded(SEEDED_IDS),
        ledger: loadLedgerSources(now),
        graceDays: graceDaysRepo.listGraceDays(),
      });
      // With the settings and the grace rows in, the days missed since the last open
      // get their grace before the first screen reads the streak.
      get().settleStreak(now);
      // A new month since the last launch brings the emergency unlocks back.
      get().settleEmergency(now);
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
      const name = duplicateName(source.name, get().modes.map((m) => m.name));
      const copy: Mode = { ...source, id: uuidv7(Date.now()), name, createdAt: Date.now() };
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
      forgetRepick(id, now);
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
      // A selection saved here is this phone's: the mode no longer waits for a repick.
      if (selectionToken !== null) {
        forgetRepick(id, Date.now());
      }
      set((state) => ({
        modes: state.modes.map((m) =>
          m.id === id ? { ...m, selectionToken, needsRepick: selectionToken === null && m.needsRepick === true } : m,
        ),
      }));
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
      // Its start mark goes with it. Nothing would read it again, and settings would
      // otherwise keep one entry for every routine ever deleted.
      const { [id]: removed, ...rest } = get().settings.routineStarts;
      if (removed !== undefined) {
        saveSettings({ ...get().settings, routineStarts: rest });
      }
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
      const settings = get().settings;
      // Settled first: an unlock spent on the 1st must come out of the new month's five.
      const current = { ...settings, ...settledEmergency(settings, Date.now()) };
      saveSettings({ ...current, emergencyLeft: Math.max(0, current.emergencyLeft - 1) });
    },

    removeDemoData: (now) => {
      demoRepo.removeSeeded(SEEDED_IDS, now);
      get().hydrate(now);
      // The start marks of the example routines go with them.
      const seededRoutines = new Set(SEEDED_IDS.schedules);
      const { routineStarts } = get().settings;
      if (Object.keys(routineStarts).some((id) => seededRoutines.has(id))) {
        const kept = Object.fromEntries(Object.entries(routineStarts).filter(([id]) => !seededRoutines.has(id)));
        saveSettings({ ...get().settings, routineStarts: kept });
      }
    },

    settleEmergency: (now) => {
      const settled = settledEmergency(get().settings, now);
      if (settled !== null) {
        saveSettings({ ...get().settings, ...settled });
      }
    },

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

    setHealthMarks: (marks, syncedAt, window) => {
      habitsRepo.replaceHealthMarks(marks, window);
      const replaced = (m: HabitMark) =>
        m.source === 'health' && (window === undefined || (m.dayKey >= window.fromKey && m.dayKey <= window.toKey));
      set((state) => ({
        habitMarks: [...state.habitMarks.filter((m) => !replaced(m)), ...marks],
      }));
      saveSettings({ ...get().settings, healthSyncedAt: syncedAt });
    },

    recordFocus: (now) =>
      set({ dayStats: loadDayStats(now, HISTORY_DAYS), lifetime: loadLifetimeTotals(now), ledger: loadLedgerSources(now) }),

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
