import { summarizeShield, type ShieldSummary } from '../../domain/shieldTally';
import * as breaksRepo from '../repositories/breaks';
import * as shieldEventsRepo from '../repositories/shieldEvents';

/**
 * What the shield saw, for a screen (ADR-0053). Derived on every read from
 * `usage_events` and `breaks`; no count is ever stored.
 */

/** Attempts and breaks in [from, to): a day for Actividad › Hoy, a week for Semanal. */
export function shieldSummaryBetween(from: number, to: number, now: number): ShieldSummary {
  return summarizeShield(shieldEventsRepo.listBetween(from, to), breaksRepo.listBetween(from, to), now);
}

/** One session's attempts and breaks, for its closing line. */
export function sessionShieldSummary(sessionId: string, now: number): ShieldSummary {
  return summarizeShield(shieldEventsRepo.listForSession(sessionId), breaksRepo.listForSession(sessionId), now);
}
