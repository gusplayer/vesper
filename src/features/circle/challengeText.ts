import type { ChallengeOutlook } from '../../domain/circle';
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
