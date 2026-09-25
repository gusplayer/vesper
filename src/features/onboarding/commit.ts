import { getModeIdeas, useAppStore } from '../../data';
import { WORK_ACTIVITY_ID } from '../../data/seed';
import { forgetOnboardingIds, saveOnboardingIds, savedOnboardingIds } from '../../data/onboardingIds';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import type { Depth } from '../../data/types';
import { readAppsStepKind } from './readAppsStepKind';

/**
 * Turns the onboarding draft into a real mode (and, when asked, its schedule) in the
 * app store. Safe to call more than once: the draft remembers the ids it created, so
 * a repeat updates the same mode and schedule instead of adding another. Two screens
 * call it — routine-set when the user saves a routine, notifications in case the
 * routine was skipped — and whichever runs first does the work.
 *
 * The mode is always the onboarding's own, even when a demo mode carries the same
 * name ("Familia", "Sin redes"): reusing that one kept the demo's apps and threw the
 * user's choice away. The ids also survive a relaunch (`savedOnboardingIds`), so an
 * app killed after the commit and onboarded again updates what the first run made.
 */
export function commitOnboarding({ withSchedule }: { withSchedule: boolean }): void {
  const draft = useOnboardingDraft.getState();
  if (draft.goalId === null) {
    return;
  }

  const idea = getModeIdeas().find((entry) => entry.id === draft.goalId);
  const depth: Depth = idea?.depth ?? 'firm';
  const activityId = idea?.activityId ?? WORK_ACTIVITY_ID;

  const { modes, schedules, upsertMode, upsertSchedule, setActiveMode } = useAppStore.getState();
  const saved = savedOnboardingIds();
  // The draft's id first; after a relaunch, the one the earlier run saved, but only
  // while that mode (or routine) still exists.
  const modeId = draft.modeId ?? (modes.some((m) => m.id === saved.modeId) ? saved.modeId : null);
  // One list per mode (ADR-0047 §2): the real selection where this phone has a real
  // picker — none at all while the access is missing — and the example names only
  // where there is no real picker.
  const kind = readAppsStepKind();
  const mode = upsertMode({
    ...(modeId === null ? {} : { id: modeId }),
    name: draft.modeName,
    behavior: 'block',
    appIds: kind === 'example' ? [...draft.appIds] : [],
    websiteIds: [],
    depth,
    activityId,
    selectionToken: kind === 'real' ? draft.selectionToken : null,
  });
  // The mode the user chose is the one the home page should show.
  setActiveMode(mode.id);

  let scheduleId =
    draft.scheduleId ?? (schedules.some((s) => s.id === saved.scheduleId) ? saved.scheduleId : null);
  if (withSchedule) {
    const schedule = upsertSchedule({
      ...(scheduleId === null ? {} : { id: scheduleId }),
      name: draft.modeName,
      modeId: mode.id,
      durationMs: null,
      startMinutes: draft.schedule.startMinutes,
      endMinutes: draft.schedule.endMinutes,
      days: [...draft.schedule.days],
      enabled: true,
    });
    scheduleId = schedule.id;
  }

  draft.markCommitted(mode.id, scheduleId);
  saveOnboardingIds({ modeId: mode.id, scheduleId }, Date.now());
}

/**
 * "Saltar" on the routine step. A routine this onboarding saved earlier (routine-set,
 * then back) is removed, or skipping would leave it running. Nothing else is touched:
 * the mode is written by the commit on the next step as usual.
 */
export function skipOnboardingRoutine(): void {
  const draft = useOnboardingDraft.getState();
  const { schedules, deleteSchedule } = useAppStore.getState();
  const saved = savedOnboardingIds();
  const scheduleId = draft.scheduleId ?? saved.scheduleId;
  if (scheduleId === null) {
    return;
  }
  if (schedules.some((s) => s.id === scheduleId)) {
    deleteSchedule(scheduleId);
  }
  const modeId = draft.modeId ?? saved.modeId;
  draft.markCommitted(modeId, null);
  saveOnboardingIds({ modeId, scheduleId: null }, Date.now());
}

/** The end of the tour: from here on, the mode and the routine belong to the app. */
export function finishOnboarding(now: number): void {
  forgetOnboardingIds(now);
  useAppStore.getState().updateSettings({ onboardingDone: true });
}
