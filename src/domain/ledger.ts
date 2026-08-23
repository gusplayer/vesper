import { elapsed } from './session';
import {
  DECLARED_DAILY_CAP_MS,
  type HealthSample,
  type Ledger,
  type LedgerInput,
  type LedgerRow,
  type Millis,
  type Session,
} from './types';

/**
 * The day ledger. Every row carries where its number came from, and rows of
 * different provenance are never added into one score — ADR-0005.
 *
 * Pure: give it the day window, the activities, the sessions and the samples.
 */

/** Overlap between an interval and the day window. */
function overlapMs(start: Millis, end: Millis, dayStart: Millis, dayEnd: Millis): number {
  return Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart));
}

function sessionMs(session: Session, now: Millis): number {
  return session.outcome === 'running' ? elapsed(session, now) : session.actualMs;
}

function healthSampleMs(sample: HealthSample, dayStart: Millis, dayEnd: Millis): number {
  return overlapMs(sample.startedAt, sample.endedAt, dayStart, dayEnd);
}

/**
 * Declared rows, one per activity that saw time today.
 *
 * A running session counts what it has served so far: the ledger is a live view of
 * the day, not a report written at midnight.
 */
function declaredRows(input: LedgerInput): LedgerRow[] {
  const byActivity = new Map<string, number>();

  for (const session of input.sessions) {
    const ms = sessionMs(session, input.now);
    if (ms <= 0) {
      continue;
    }
    byActivity.set(session.activityId, (byActivity.get(session.activityId) ?? 0) + ms);
  }

  const rows: LedgerRow[] = [];
  for (const activity of input.activities) {
    const ms = byActivity.get(activity.id);
    if (ms === undefined || ms <= 0) {
      continue;
    }
    rows.push({ key: activity.key, label: activity.label, ms, provenance: 'declared' });
  }

  return rows.sort((a, b) => b.ms - a.ms);
}

const HEALTH_LABELS: Record<string, string> = {
  workout: 'entrenamiento',
  steps: 'caminata',
  sleep: 'sueño',
  exercise_time: 'ejercicio',
};

/** Verified rows, one per health type. Never capped: verified time is celebrated. */
function verifiedRows(input: LedgerInput): LedgerRow[] {
  const byType = new Map<string, number>();

  for (const sample of input.healthSamples) {
    const ms = healthSampleMs(sample, input.dayStart, input.dayEnd);
    if (ms <= 0) {
      continue;
    }
    byType.set(sample.type, (byType.get(sample.type) ?? 0) + ms);
  }

  const rows: LedgerRow[] = [];
  for (const [type, ms] of byType) {
    rows.push({
      key: type,
      label: HEALTH_LABELS[type] ?? type,
      ms,
      provenance: 'verified',
    });
  }

  return rows.sort((a, b) => b.ms - a.ms);
}

function sumMs(rows: LedgerRow[]): number {
  return rows.reduce((total, row) => total + row.ms, 0);
}

export function buildLedger(input: LedgerInput): Ledger {
  const declared = declaredRows(input);
  const verified = verifiedRows(input);

  const declaredMs = sumMs(declared);
  const declaredCapped = declaredMs > DECLARED_DAILY_CAP_MS;
  const countedDeclaredMs = Math.min(declaredMs, DECLARED_DAILY_CAP_MS);

  const estimated: LedgerRow[] =
    input.usageEstimateMs > 0
      ? [
          {
            key: 'usage',
            label: 'redes',
            ms: input.usageEstimateMs,
            provenance: 'estimated',
          },
        ]
      : [];

  /**
   * `sin registrar` is the rest of the day so far. Bounded by `now`, because the
   * future is not unregistered time, and by the real day length, because a DST day
   * lasts 23h or 25h.
   *
   * Note it subtracts the capped declared total, not the real one: time declared
   * beyond the 6h cap gets no credit in the day's allocation. Rows still show what
   * the user actually declared — the ledger is a mirror, not a judge.
   */
  const daySoFar = Math.max(0, Math.min(input.now, input.dayEnd) - input.dayStart);
  const accounted = countedDeclaredMs + sumMs(verified) + sumMs(estimated);
  const unknownMs = Math.max(0, daySoFar - accounted);

  const rows = [...declared, ...verified, ...estimated];
  if (unknownMs > 0) {
    rows.push({
      key: 'unknown',
      label: 'sin registrar',
      ms: unknownMs,
      provenance: 'unknown',
    });
  }

  return { rows, declaredMs, declaredCapped };
}
