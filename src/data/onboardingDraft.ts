import { create } from 'zustand';

import type { ModeIdea, Schedule } from './types';

/**
 * What the onboarding collects before anything is written to the app store: the
 * goal (a MODE_IDEAS entry), the mode name, the apps, the real selection when the
 * phone can block, and the optional routine. The mode and its schedule are created
 * by `commitOnboarding`, which records the ids here so a second commit updates
 * instead of duplicating.
 *
 * The routine starts as whatever the chosen idea proposes: `setGoal` copies the
 * idea's window, so "Dormir" opens the routine screen at 22:00 and "Trabajo" at
 * 9:00. The one in `INITIAL` is only what a draft without a goal would show.
 *
 * The draft lives in memory only. The two ids the commit created are also written to
 * the settings table, by `onboardingIds.ts` (the commit calls it), so an app killed
 * between the commit and the end of the tour does not duplicate them on the redo.
 */

export type DraftSchedule = Pick<Schedule, 'startMinutes' | 'endMinutes' | 'days'>;

type OnboardingDraft = {
  goalId: string | null;
  modeName: string;
  /** The catalogue ids: what the mode shows, and all it has where nothing can block. */
  appIds: string[];
  /**
   * The real selection from the system picker (a Screen Time token on iOS, the
   * package list on Android), or null where the phone cannot block or nothing was
   * picked. This, not `appIds`, is what the shield reads (domain/blocking).
   */
  selectionToken: string | null;
  schedule: DraftSchedule;
  /** True once the mode exists in the app store. */
  committed: boolean;
  /** The ids of what the commit created, so it can be repeated safely. */
  modeId: string | null;
  scheduleId: string | null;

  /** The chosen idea fills the name, the apps and the proposed routine, all by value. */
  setGoal: (idea: ModeIdea) => void;
  setAppIds: (appIds: readonly string[]) => void;
  setSelectionToken: (token: string | null) => void;
  setSchedule: (patch: Partial<DraftSchedule>) => void;
  /** Records what the commit created. */
  markCommitted: (modeId: string | null, scheduleId: string | null) => void;
  reset: () => void;
};

const WEEKDAYS = [true, true, true, true, true, false, false];

const INITIAL = {
  goalId: null,
  modeName: '',
  appIds: [],
  selectionToken: null,
  schedule: { startMinutes: 21 * 60, endMinutes: null, days: WEEKDAYS },
  committed: false,
  modeId: null,
  scheduleId: null,
} satisfies Omit<
  OnboardingDraft,
  'setGoal' | 'setAppIds' | 'setSelectionToken' | 'setSchedule' | 'markCommitted' | 'reset'
>;

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

  setSelectionToken: (selectionToken) => set({ selectionToken }),

  setSchedule: (patch) => set((state) => ({ schedule: { ...state.schedule, ...patch } })),

  markCommitted: (modeId, scheduleId) => set({ committed: true, modeId, scheduleId }),

  reset: () =>
    set({ ...INITIAL, appIds: [], schedule: { ...INITIAL.schedule, days: [...WEEKDAYS] } }),
}));
