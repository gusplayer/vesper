import * as settingsRepo from '../db/repositories/settings';

/**
 * The ids of what the onboarding commit created, kept in the settings table until
 * the tour ends. The draft (`onboardingDraft.ts`) lives in memory: an app killed
 * between the commit and "Listo" starts the onboarding again with an empty draft, and
 * without these the redo would add a second mode and a second routine next to the
 * first ones. A plain row of the key-value table, like `active_mode_id`; "Borrar todo
 * y reiniciar" empties it with the rest.
 */

export type OnboardingIds = { modeId: string | null; scheduleId: string | null };

const NO_IDS: OnboardingIds = { modeId: null, scheduleId: null };

function idOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Reads a stored value defensively: anything that is not the expected shape is "none". */
export function parseOnboardingIds(raw: unknown): OnboardingIds {
  if (typeof raw !== 'object' || raw === null) {
    return NO_IDS;
  }
  const value = raw as Record<string, unknown>;
  return { modeId: idOrNull(value.modeId), scheduleId: idOrNull(value.scheduleId) };
}

/** What an earlier onboarding run on this phone committed, if it never reached the end. */
export function savedOnboardingIds(): OnboardingIds {
  return parseOnboardingIds(settingsRepo.getJson<unknown>(settingsRepo.SETTING_KEYS.onboardingIds));
}

export function saveOnboardingIds(ids: OnboardingIds, now: number): void {
  settingsRepo.setJson(settingsRepo.SETTING_KEYS.onboardingIds, ids, now);
}

/** Called when the onboarding ends: from then on the mode and the routine are the user's. */
export function forgetOnboardingIds(now: number): void {
  settingsRepo.setJson(settingsRepo.SETTING_KEYS.onboardingIds, null, now);
}
