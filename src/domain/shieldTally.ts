import type { BreakRecord, Millis, ShieldEventRow } from './types';

/**
 * What the shield saw, folded into counts (ADR-0053). Pure: the rows come from
 * src/db/queries, the numbers go to the closing line, Actividad and the shield itself.
 *
 * An attempt is the shield covering an app of the session. Android sees every one
 * ('shield_hit'). iOS only learns of it when a button is tapped, so there an attempt is
 * a back or a break, and the count is a floor: `floor` says so, and the screen writes
 * "al menos". A mix of both (a backup restored across platforms) counts each event by
 * its own platform.
 *
 * These are counts and pauses, never time of use: a break lifts the whole shield and
 * nobody knows what was opened during it. Nothing here joins a currency (rule 9).
 */

export type ShieldTally = {
  attempts: number;
  /** Taps on "Volver al foco". */
  backs: number;
  breaks: number;
  /** What the breaks actually took, a running one up to now. */
  breakMs: number;
};

export type AppShieldTally = ShieldTally & {
  /** The package on Android, the encoded ApplicationToken on iOS. */
  token: string;
};

export type ShieldSummary = ShieldTally & {
  /** Some attempt could only be counted from a tap (iOS): the total is a floor. */
  floor: boolean;
  /** Only what happened over an app: breaks from the session's own button have none. Most attempts first. */
  byApp: AppShieldTally[];
};

const EMPTY: ShieldTally = { attempts: 0, backs: 0, breaks: 0, breakMs: 0 };

/** Whether this event is an attempt on its platform. */
function isAttempt(event: ShieldEventRow): boolean {
  if (event.platform === 'android') {
    return event.kind === 'shield_hit';
  }
  return event.kind === 'backed_off' || event.kind === 'unlock_granted';
}

/** What a break took: to its end, or up to now (capped at its length) while it runs. */
export function breakTook(record: BreakRecord, now: Millis): number {
  const end = record.endedAt ?? Math.min(now, record.startedAt + record.lengthMs);
  return Math.max(0, end - record.startedAt);
}

/**
 * Folds the events and breaks of a span into totals and a line per app. The caller
 * picks the span (a day, a week, a session); every row passed in counts.
 */
export function summarizeShield(
  events: readonly ShieldEventRow[],
  breaks: readonly BreakRecord[],
  now: Millis,
): ShieldSummary {
  const total: ShieldTally = { ...EMPTY };
  const perApp = new Map<string, ShieldTally>();
  const lineOf = (token: string): ShieldTally => {
    const found = perApp.get(token);
    if (found !== undefined) {
      return found;
    }
    const line = { ...EMPTY };
    perApp.set(token, line);
    return line;
  };

  let floor = false;
  for (const event of events) {
    const line = lineOf(event.token);
    if (isAttempt(event)) {
      total.attempts += 1;
      line.attempts += 1;
      floor = floor || event.platform === 'ios';
    }
    if (event.kind === 'backed_off') {
      total.backs += 1;
      line.backs += 1;
    }
  }

  for (const record of breaks) {
    const took = breakTook(record, now);
    total.breaks += 1;
    total.breakMs += took;
    if (record.token !== null) {
      const line = lineOf(record.token);
      line.breaks += 1;
      line.breakMs += took;
    }
  }

  const byApp = [...perApp.entries()]
    .map(([token, line]) => ({ token, ...line }))
    .sort((a, b) => b.attempts - a.attempts || b.breakMs - a.breakMs || a.token.localeCompare(b.token));
  return { ...total, floor, byApp };
}

/** Nothing to say: no attempt and no break. The screens leave the line out then. */
export function isQuiet(tally: ShieldTally): boolean {
  return tally.attempts === 0 && tally.breaks === 0;
}
