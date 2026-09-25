import { beforeEach, describe, expect, it } from 'vitest';

import { es } from '../i18n/es';
import { useOnboardingDraft } from './onboardingDraft';
import { demoModeIdeas } from './seed';
import type { ModeIdea } from './types';

const ideas = demoModeIdeas(es.demo);

function idea(id: string): ModeIdea {
  const found = ideas.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`no idea ${id}`);
  }
  return found;
}

beforeEach(() => {
  useOnboardingDraft.getState().reset();
});

describe('useOnboardingDraft', () => {
  it('fills the routine from the chosen idea, not from one hour for all', () => {
    useOnboardingDraft.getState().setGoal(idea('idea-sleep'));
    const sleep = useOnboardingDraft.getState().schedule;
    expect(sleep.startMinutes).toBe(22 * 60);
    expect(sleep.endMinutes).toBeNull();
    expect(sleep.days.every(Boolean)).toBe(true);

    useOnboardingDraft.getState().setGoal(idea('idea-work'));
    const work = useOnboardingDraft.getState().schedule;
    expect(work.startMinutes).toBe(9 * 60);
    expect(work.endMinutes).toBe(18 * 60);
    expect(work.days).toEqual([true, true, true, true, true, false, false]);
  });

  it('takes the name and the apps of the idea by value', () => {
    const family = idea('idea-family');
    useOnboardingDraft.getState().setGoal(family);

    const draft = useOnboardingDraft.getState();
    expect(draft.goalId).toBe('idea-family');
    expect(draft.modeName).toBe(family.name);
    expect(draft.appIds).toEqual(family.appIds);
    expect(draft.appIds).not.toBe(family.appIds);
    expect(draft.schedule.days).not.toBe(family.schedule.days);
  });

  it('never writes back into the idea when the user edits the draft', () => {
    const work = idea('idea-work');
    useOnboardingDraft.getState().setGoal(work);
    useOnboardingDraft.getState().setSchedule({ startMinutes: 6 * 60, days: [true, false, false, false, false, false, false] });
    useOnboardingDraft.getState().setAppIds(['instagram']);

    expect(work.schedule.startMinutes).toBe(9 * 60);
    expect(work.schedule.days).toEqual([true, true, true, true, true, false, false]);
    expect(work.appIds.length).toBeGreaterThan(1);
  });

  it('keeps the real selection when the goal changes: it is the phone, not the idea', () => {
    useOnboardingDraft.getState().setGoal(idea('idea-work'));
    useOnboardingDraft.getState().setSelectionToken('token-1');
    useOnboardingDraft.getState().setGoal(idea('idea-sleep'));

    expect(useOnboardingDraft.getState().selectionToken).toBe('token-1');
  });

  it('reset clears the goal and goes back to the neutral routine', () => {
    useOnboardingDraft.getState().setGoal(idea('idea-sleep'));
    useOnboardingDraft.getState().setSelectionToken('token-1');
    useOnboardingDraft.getState().markCommitted('mode-1', 'schedule-1');
    useOnboardingDraft.getState().reset();

    const draft = useOnboardingDraft.getState();
    expect(draft.goalId).toBeNull();
    expect(draft.modeName).toBe('');
    expect(draft.appIds).toEqual([]);
    expect(draft.selectionToken).toBeNull();
    expect(draft.modeId).toBeNull();
    expect(draft.scheduleId).toBeNull();
    expect(draft.schedule.startMinutes).toBe(21 * 60);
    expect(draft.schedule.days).toEqual([true, true, true, true, true, false, false]);
  });
});
