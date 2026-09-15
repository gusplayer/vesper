import { create } from 'zustand';

import { dayKeyOf } from '../../domain/day';
import type { Habit, HabitMark } from '../../domain/types';
import { uuidv7 } from '../../lib/uuid';
import {
  HABITS,
  MODES,
  SCHEDULES,
  SETTINGS,
  seedDayStats,
  seedHabitMarks,
} from '../seed';
import type { DayStat, Mode, NotificationPrefs, Rules, Schedule, Settings } from '../types';

/**
 * The prototype's whole world, in memory, seeded once. Every screen reads from here
 * through the hooks in src/data/index.ts and writes through these actions. Nothing is
 * persisted: relaunching the app resets it (ADR-0016).
 */

type AppState = {
  modes: Mode[];
  activeModeId: string;
  schedules: Schedule[];
  settings: Settings;
  habits: Habit[];
  habitMarks: HabitMark[];
  dayStats: DayStat[];

  // Modes
  upsertMode: (mode: Omit<Mode, 'id' | 'createdAt'> & { id?: string }) => Mode;
  duplicateMode: (id: string) => void;
  deleteMode: (id: string) => void;
  setActiveMode: (id: string) => void;

  // Schedules
  upsertSchedule: (schedule: Omit<Schedule, 'id'> & { id?: string }) => Schedule;
  toggleSchedule: (id: string, enabled: boolean) => void;
  deleteSchedule: (id: string) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
  updateRules: (patch: Partial<Rules>) => void;
  updateNotifications: (patch: Partial<NotificationPrefs>) => void;
  useEmergency: () => void;
  dismissBanner: () => void;

  // Habits
  upsertHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archivedAt'> & { id?: string }) => void;
  archiveHabit: (id: string) => void;
  toggleHabitToday: (id: string, now: number) => void;

  // Stats
  recordFocus: (now: number, focusMs: number) => void;
};

const NOW = Date.now();

export const useAppStore = create<AppState>((set, get) => ({
  modes: MODES,
  activeModeId: MODES[0]?.id ?? '',
  schedules: SCHEDULES,
  settings: SETTINGS,
  habits: HABITS,
  habitMarks: seedHabitMarks(NOW),
  dayStats: seedDayStats(NOW),

  upsertMode: (input) => {
    const existing = input.id === undefined ? undefined : get().modes.find((m) => m.id === input.id);
    const mode: Mode = {
      ...input,
      id: existing?.id ?? uuidv7(Date.now()),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    set((state) => ({
      modes: existing
        ? state.modes.map((m) => (m.id === mode.id ? mode : m))
        : [...state.modes, mode],
      activeModeId: state.modes.length === 0 ? mode.id : state.activeModeId,
    }));
    return mode;
  },

  duplicateMode: (id) => {
    const source = get().modes.find((m) => m.id === id);
    if (source === undefined) {
      return;
    }
    const copy: Mode = { ...source, id: uuidv7(Date.now()), name: `${source.name} (1)`, createdAt: Date.now() };
    set((state) => {
      const index = state.modes.findIndex((m) => m.id === id);
      const modes = [...state.modes];
      modes.splice(index + 1, 0, copy);
      return { modes };
    });
  },

  deleteMode: (id) => {
    set((state) => {
      const modes = state.modes.filter((m) => m.id !== id);
      return {
        modes,
        // Schedules using this mode are turned off, like Brick warns.
        schedules: state.schedules.map((s) => (s.modeId === id ? { ...s, enabled: false } : s)),
        activeModeId: state.activeModeId === id ? (modes[0]?.id ?? '') : state.activeModeId,
      };
    });
  },

  setActiveMode: (id) => set({ activeModeId: id }),

  upsertSchedule: (input) => {
    const schedule: Schedule = { ...input, id: input.id ?? uuidv7(Date.now()) };
    set((state) => ({
      schedules: state.schedules.some((s) => s.id === schedule.id)
        ? state.schedules.map((s) => (s.id === schedule.id ? schedule : s))
        : [...state.schedules, schedule],
    }));
    return schedule;
  },

  toggleSchedule: (id, enabled) =>
    set((state) => ({ schedules: state.schedules.map((s) => (s.id === id ? { ...s, enabled } : s)) })),

  deleteSchedule: (id) => set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) })),

  updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

  updateRules: (patch) =>
    set((state) => ({ settings: { ...state.settings, rules: { ...state.settings.rules, ...patch } } })),

  updateNotifications: (patch) =>
    set((state) => ({
      settings: { ...state.settings, notifications: { ...state.settings.notifications, ...patch } },
    })),

  useEmergency: () =>
    set((state) => ({
      settings: { ...state.settings, emergencyLeft: Math.max(0, state.settings.emergencyLeft - 1) },
    })),

  dismissBanner: () => set((state) => ({ settings: { ...state.settings, pendingBanner: null } })),

  upsertHabit: (input) => {
    set((state) => {
      const existing = input.id === undefined ? undefined : state.habits.find((h) => h.id === input.id);
      const habit: Habit = {
        ...input,
        id: existing?.id ?? uuidv7(Date.now()),
        createdAt: existing?.createdAt ?? Date.now(),
        archivedAt: null,
      };
      return {
        habits: existing
          ? state.habits.map((h) => (h.id === habit.id ? habit : h))
          : [...state.habits, habit],
      };
    });
  },

  archiveHabit: (id) =>
    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? { ...h, archivedAt: Date.now() } : h)),
    })),

  toggleHabitToday: (id, now) => {
    const dayKey = dayKeyOf(now);
    set((state) => {
      const existing = state.habitMarks.find(
        (m) => m.habitId === id && m.dayKey === dayKey && m.source !== 'health',
      );
      if (existing !== undefined) {
        return { habitMarks: state.habitMarks.filter((m) => m !== existing) };
      }
      return {
        habitMarks: [
          ...state.habitMarks,
          { id: uuidv7(now), habitId: id, dayKey, source: 'manual', sourceRef: '', durationMs: null, markedAt: now },
        ],
      };
    });
  },

  recordFocus: (now, focusMs) => {
    const dayKey = dayKeyOf(now);
    set((state) => ({
      dayStats: state.dayStats.map((d) =>
        d.dayKey === dayKey
          ? {
              ...d,
              focusMs: d.focusMs + focusMs,
              sessions: d.sessions + 1,
              segments: [...d.segments, { start: 0.5, end: 0.5 + focusMs / 86_400_000 }],
            }
          : d,
      ),
    }));
  },
}));
