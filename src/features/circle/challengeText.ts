import type { ChallengeOutlook } from '../../domain/circle';
import { healthTypeFor } from '../../domain/habits';
import { stepGoalFor } from '../../domain/healthMarks';
import type { MarkSource } from '../../domain/types';
import type { Strings } from '../../i18n';

type CircleStrings = Strings['circle'];

/**
 * How the week is going, in one line (ADR-0031): 'Cumpliste esta semana', 'Te faltan
 * 2 · quedan 3 días', 'Solo sale marcando los 2 días que quedan', 'Esta semana ya no
 * sale'. The card, the challenge screen, Actividad and Focus all say it the same way,
 * because it is the same fact.
 */
export function challengeOutlookText(outlook: ChallengeOutlook, t: CircleStrings): string {
  switch (outlook.risk) {
    case 'met':
      return t.challenge.outlook.met;
    case 'atRisk':
      return t.challenge.outlook.atRisk(outlook.daysLeft);
    case 'missed':
      return t.challenge.outlook.missed;
    case 'onTrack':
    case 'tight':
      return t.challenge.outlook.left(outlook.needed, outlook.daysLeft);
  }
}

/**
 * What joining shares, said above the button of a challenge Health can confirm
 * (ADR-0042 §5): the days, never the numbers. Null for a challenge nothing verifies,
 * where the marks are taps and there is no Health data to speak of.
 */
export function challengeConsentText(name: string, t: CircleStrings, tag: string): string | null {
  const type = healthTypeFor(name.trim());
  if (type === null) {
    return null;
  }
  return type === 'steps' ? t.challenge.consentSteps(stepGoalFor(name), tag) : t.challenge.consentHealth;
}

/** How one person's week was counted: 'con Salud', 'marcado a mano'. Null with no marks. */
export function standingSourceText(source: MarkSource | null, t: CircleStrings): string | null {
  return source === null ? null : t.challenge.source[source];
}
