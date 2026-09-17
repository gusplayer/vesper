import { create } from 'zustand';

import type { Schedule } from './types';

/**
 * What the onboarding collects before anything is written to the app store: the
 * goal (a MODE_IDEAS entry), the mode name, the apps, and the optional routine.
 * The mode and its schedule are created once by `commitOnboarding`, which records
 * the ids here so a second commit updates instead of duplicating.
 */

export type DraftSchedule = Pick<Schedule, 'startMinutes' | 'endMinutes' | 'days'>;

type OnboardingDraft = {
  goalId: string | null;
  modeName: string;
  appIds: string[];
  schedule: DraftSchedule;
  /** True once the mode exists in the app store. */
  committed: boolean;
  /** Ids of what the commit created, so it can be repeated safely. */
  modeId: string | null;
  scheduleId: string | null;

  setGoal: (goalId: string, modeName: string, appIds: readonly string[]) => void;
  setAppIds: (appIds: readonly string[]) => void;
  setSchedule: (patch: Partial<DraftSchedule>) => void;
  markCommitted: (modeId: string, scheduleId: string | null) => void;
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

  setGoal: (goalId, modeName, appIds) => set({ goalId, modeName, appIds: [...appIds] }),

  setAppIds: (appIds) => set({ appIds: [...appIds] }),

  setSchedule: (patch) => set((state) => ({ schedule: { ...state.schedule, ...patch } })),

  markCommitted: (modeId, scheduleId) => set({ committed: true, modeId, scheduleId }),

  reset: () => set({ ...INITIAL, appIds: [], schedule: { ...INITIAL.schedule, days: [...WEEKDAYS] } }),
}));
