import { dayBounds, dayStartShifted } from '../../domain/day';
import type { Activity, Millis, Session } from '../../domain/types';
import * as activitiesRepo from '../repositories/activities';
import * as sessionsRepo from '../repositories/sessions';

export type LedgerSources = {
  sessions: Session[];
  /** From the table the sessions point at, so every row can be labelled. */
  activities: Activity[];
};

/**
 * What today's ledger reads (ADR-0010, ADR-0038). Not a fold: the ledger measures
 * the union of intervals, so it wants the sessions themselves, not totals.
 *
 * The window opens a day early because `listBetween` filters by `started_at` and a
 * session that began at 23:40 yesterday still occupies this morning. `buildLedger`
 * clips every interval to the day, so a session that ended before midnight
 * contributes nothing and costs one row.
 *
 * A running session is included: `occupiedIntervals` measures it against `now`.
 */
export function loadLedgerSources(now: Millis): LedgerSources {
  return {
    sessions: sessionsRepo.listBetween(dayStartShifted(now, -1), dayBounds(now).dayEnd),
    activities: activitiesRepo.listActive(),
  };
}
