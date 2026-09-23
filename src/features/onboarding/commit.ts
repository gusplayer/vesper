import { getModeIdeas, useAppStore } from '../../data';
import { findModeByName } from '../../data/modes';
import { WORK_ACTIVITY_ID } from '../../data/seed';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import type { Depth } from '../../data/types';

/**
 * Turns the onboarding draft into a real mode (and, when asked, its schedule) in the
 * app store. Safe to call more than once: the draft remembers the ids it created, so
 * a repeat updates the same mode and schedule instead of adding another. Two screens
 * call it — routine-set when the user saves a routine, notifications in case the
 * routine was skipped — and whichever runs first does the work.
 *
 * A mode that already carries the draft's name (the demo "Sin redes", say) is reused
 * as it is, never rewritten and never duplicated: the routine and the home page
 * point at it.
 */
export function commitOnboarding({ withSchedule }: { withSchedule: boolean }): void {
  const draft = useOnboardingDraft.getState();
  if (draft.goalId === null) {
    return;
  }

  const idea = getModeIdeas().find((entry) => entry.id === draft.goalId);
  const depth: Depth = idea?.depth ?? 'firm';
  const activityId = idea?.activityId ?? WORK_ACTIVITY_ID;

  const { modes, upsertMode, upsertSchedule, setActiveMode } = useAppStore.getState();
  // Only a mode this draft created is updated on a repeat; an existing one is found
  // by name and left alone.
  const existing = draft.modeId === null ? findModeByName(modes, draft.modeName) : undefined;
  const mode =
    existing ??
    upsertMode({
      ...(draft.modeId === null ? {} : { id: draft.modeId }),
      name: draft.modeName,
      behavior: 'block',
      appIds: [...draft.appIds],
      websiteIds: [],
      depth,
      activityId,
    });
  // The mode the user chose is the one the home page should show.
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

  draft.markCommitted(existing === undefined ? mode.id : null, scheduleId);
}
