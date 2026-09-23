import { healthTypeFor } from '../../domain/habits';
import type { CountMode, HealthType } from '../../domain/types';
import type { Strings } from '../../i18n/es';

/**
 * Whether the habit being written can be counted as verified, what gets saved, and
 * the line that says why not (ADR-0041).
 *
 * Two reasons, never mixed, because each one has its own fix:
 * - Health is not connected, or does not exist on this phone. The habit still works:
 *   a verified habit without Health takes a manual tap (ADR-0005). Fixed in Ajustes.
 * - Nothing can verify this name. Health never marks it and a verified habit is not
 *   marked by hand either, so the option falls to declared. Fixed by renaming.
 *
 * Only the second one takes the option away. The name is free text (ADR-0008), so
 * falling is the whole answer: the user keeps the name and keeps a habit that works.
 *
 * Pure: the name, what the user chose, what src/platform/health.ts says and the
 * `habits.form` slice of the dictionary in; what to save and what to show out.
 */

export type HabitFormStrings = Strings['habits']['form'];

/** What Health can do here: `status()` from src/platform/health.ts, plus the setting. */
export type HealthState = {
  /** `status().available`: the module exists and this phone has HealthKit. */
  available: boolean;
  /** `status().reason`, already in the user's language. Null when Health works. */
  reason: string | null;
  /** The user went through the HealthKit sheet (`settings.healthConnected`). */
  connected: boolean;
};

export type VerifiedOption = {
  /** False when nothing can verify this name: the card is muted and cannot be chosen. */
  verifiable: boolean;
  /** The mode that gets saved, whatever was chosen before the name changed. */
  countMode: CountMode;
  /** The type that gets saved: null unless the habit really ends up verified. */
  healthType: HealthType | null;
  /** The verified card's second line. */
  description: string;
  /** One line under the cards. Always there, so typing never moves the layout. */
  note: string;
};

/**
 * The name line waits until there is a name: an empty field has not failed at
 * anything, and the new-habit screen opens on one.
 */
function noteFor(
  verifiable: boolean,
  named: boolean,
  health: HealthState,
  t: HabitFormStrings,
): string {
  if (!verifiable && named) {
    return t.note.name;
  }
  if (!health.available && health.reason !== null) {
    return t.note.unavailable(health.reason);
  }
  return health.connected ? t.note.connected : t.note.disconnected;
}

export function verifiedOption(
  name: string,
  chosen: CountMode,
  health: HealthState,
  t: HabitFormStrings,
): VerifiedOption {
  const trimmed = name.trim();
  const healthType = healthTypeFor(trimmed);
  const verifiable = healthType !== null;
  const countMode: CountMode = verifiable ? chosen : 'declared';
  return {
    verifiable,
    countMode,
    healthType: countMode === 'verified' ? healthType : null,
    description: verifiable ? t.verifiedDescription : t.verifiedUnavailable,
    note: noteFor(verifiable, trimmed !== '', health, t),
  };
}
