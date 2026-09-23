import { create } from 'zustand';

import type { ModeIdea, Schedule } from './types';

/**
 * What the onboarding collects before anything is written to the app store: the
 * goal (a MODE_IDEAS entry), the mode name, the apps, and the optional routine.
 * The mode and its schedule are created once by `commitOnboarding`, which records
 * the ids here so a second commit updates instead of duplicating.
 *
 * The routine starts as whatever the chosen idea proposes: `setGoal` copies the
 * idea's window, so "Dormir" opens the routine screen at 22:00 and "Trabajo" at
 * 9:00. The one in `INITIAL` is only what a draft without a goal would show.
 */

export type DraftSchedule = Pick<Schedule, 'startMinutes' | 'endMinutes' | 'days'>;

type OnboardingDraft = {
  goalId: string | null;
  modeName: string;
  appIds: string[];
  schedule: DraftSchedule;
  /** True once the mode exists in the app store. */
  committed: boolean;
  /**
   * Ids of what the commit created, so it can be repeated safely. `modeId` stays
   * null when the commit reused a mode that already had the draft's name: a repeat
   * finds it by name again and never rewrites it.
   */
  modeId: string | null;
  scheduleId: string | null;

  /** The chosen idea fills the name, the apps and the proposed routine, all by value. */
  setGoal: (idea: ModeIdea) => void;
  setAppIds: (appIds: readonly string[]) => void;
  setSchedule: (patch: Partial<DraftSchedule>) => void;
  markCommitted: (modeId: string | null, scheduleId: string | null) => void;
  reset: () => void;
};

const WEEKDAYS = [true, true, true, true, true, false, false];

const INITIAL = {
  goalId: null,
  modeName: '',
  appIds: [],
  schedule: { startMinutes: 21 * 60, endMinutes: null, days: WEEKDAYS },
  committed: false,
  modeId: null,
  scheduleId: null,
} satisfies Omit<OnboardingDraft, 'setGoal' | 'setAppIds' | 'setSchedule' | 'markCommitted' | 'reset'>;

export const useOnboardingDraft = create<OnboardingDraft>((set) => ({
  ...INITIAL,

  setGoal: (idea) =>
    set({
      goalId: idea.id,
      modeName: idea.name,
      appIds: [...idea.appIds],
      schedule: { ...idea.schedule, days: [...idea.schedule.days] },
    }),

  setAppIds: (appIds) => set({ appIds: [...appIds] }),

  setSchedule: (patch) => set((state) => ({ schedule: { ...state.schedule, ...patch } })),

  markCommitted: (modeId, scheduleId) => set({ committed: true, modeId, scheduleId }),

  reset: () => set({ ...INITIAL, appIds: [], schedule: { ...INITIAL.schedule, days: [...WEEKDAYS] } }),
}));
