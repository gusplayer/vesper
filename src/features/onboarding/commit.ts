import { MODE_IDEAS, useAppStore } from '../../data';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import type { Depth } from '../../data/types';

/**
 * Turns the onboarding draft into a real mode (and, when asked, its schedule) in the
 * app store. Safe to call more than once: the draft remembers the ids it created, so
 * a repeat updates the same mode and schedule instead of adding another. Two screens
 * call it — routine-set when the user saves a routine, notifications in case the
 * routine was skipped — and whichever runs first does the work.
 */
export function commitOnboarding({ withSchedule }: { withSchedule: boolean }): void {
  const draft = useOnboardingDraft.getState();
  if (draft.goalId === null) {
    return;
  }

  const idea = MODE_IDEAS.find((entry) => entry.id === draft.goalId);
  const depth: Depth = idea?.depth ?? 'firm';
  const activityId = draft.goalId === 'idea-family' ? 'familia' : 'trabajo';

  const { upsertMode, upsertSchedule, setActiveMode } = useAppStore.getState();
  const mode = upsertMode({
    ...(draft.modeId === null ? {} : { id: draft.modeId }),
    name: draft.modeName,
    behavior: 'block',
    appIds: [...draft.appIds],
    websiteIds: [],
    depth,
    activityId,
  });
  // The first mode the user made is the one the home page should show.
  setActiveMode(mode.id);

  let scheduleId = draft.scheduleId;
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
}
