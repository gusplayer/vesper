import type { MyChallengeWeek } from '../../data';
import type { ChallengeRisk } from '../../domain/circle';

/**
 * Which challenge the home page speaks about, when the user is in more than one: the
 * one closest to being lost, because that is the only one where a line on the home
 * page changes anything. A week already kept says so last (ADR-0031).
 */
const RISK_ORDER: Record<ChallengeRisk, number> = { atRisk: 0, tight: 1, missed: 2, onTrack: 3, met: 4 };

export function pickHomeChallenge(weeks: readonly MyChallengeWeek[]): MyChallengeWeek | null {
  const active = weeks.filter((week) => week.status === 'active');
  return (
    [...active].sort(
      (a, b) => RISK_ORDER[a.outlook.risk] - RISK_ORDER[b.outlook.risk] || b.outlook.needed - a.outlook.needed,
    )[0] ?? null
  );
}
