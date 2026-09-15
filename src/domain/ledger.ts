import { served } from './session';
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
 * The day ledger. Every row carries where its number came from, and no figure of one
 * provenance is ever added to a figure of another — ADR-0005 and rule 9 in CLAUDE.md.
 *
 * `sin registrar` is the part of the elapsed day that no interval covers. It is a set
 * operation, not a sum, which is how the rule holds literally instead of by exception,
 * and why a verified workout inside a declared session occupies the clock once. See
 * docs/adr/0010-unregistered-row.md.
 *
 * Pure: give it the day window, the activities, the sessions and the samples.
 */

type Interval = {
  start: Millis;
  end: Millis;
};

/** The part of an interval inside the window, or null when it falls outside. */
function clip(interval: Interval, from: Millis, to: Millis): Interval | null {
  const start = Math.max(interval.start, from);
  const end = Math.min(interval.end, to);
  return end > start ? { start, end } : null;
}

/**
 * Total time covered by the union of the intervals. Overlaps count once — that is the
 * whole point of measuring this way instead of adding durations.
 */
function unionMeasure(intervals: Interval[]): number {
  if (intervals.length === 0) {
    return 0;
  }

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let currentStart = sorted[0]?.start ?? 0;
  let currentEnd = sorted[0]?.end ?? 0;

  for (const interval of sorted.slice(1)) {
    if (interval.start > currentEnd) {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    } else if (interval.end > currentEnd) {
      currentEnd = interval.end;
    }
  }

  return total + (currentEnd - currentStart);
}

/**
 * The stretch of clock a session occupies: from its start, for as long as it served.
 * Not `[startedAt, endedAt]` — a session closed on returning from background has an
 * endedAt past its planned end, and it never gets credit for time it did not serve.
 */
function sessionInterval(session: Session, now: Millis): Interval {
  return { start: session.startedAt, end: session.startedAt + served(session, now) };
}

function sampleInterval(sample: HealthSample): Interval {
  return { start: sample.startedAt, end: sample.endedAt };
}

/**
 * Row keys are namespaced so a user activity named 'unknown' or 'sleep' can never
 * collide with the health, usage or unregistered rows. The UI uses them as identity.
 */
const ROW_KEY = {
  activity: (key: string) => `activity:${key}`,
  health: (type: HealthSample['type']) => `health:${type}`,
  usage: 'usage',
  unknown: 'unknown',
} as const;

const HEALTH_LABELS: Record<HealthSample['type'], string> = {
  workout: 'entrenamiento',
  steps: 'caminata',
  sleep: 'sueño',
  exercise_time: 'ejercicio',
};

function rowsFromGroups(
  groups: Map<string, { label: string; intervals: Interval[] }>,
  provenance: 'declared' | 'verified',
): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const [key, group] of groups) {
    const ms = unionMeasure(group.intervals);
    if (ms > 0) {
      rows.push({ key, label: group.label, ms, provenance });
    }
  }
  return rows.sort((a, b) => b.ms - a.ms);
}

export function buildLedger(input: LedgerInput): Ledger {
  // The window closes at `now`: the future is not unregistered time. dayEnd bounds it
  // too, because a local day is 23 or 25 hours long twice a year.
  const from = input.dayStart;
  const to = Math.min(input.now, input.dayEnd);

  const declaredGroups = new Map<string, { label: string; intervals: Interval[] }>();
  for (const activity of input.activities) {
    declaredGroups.set(activity.id, { label: activity.label, intervals: [] });
  }

  const declaredIntervals: Interval[] = [];
  for (const session of input.sessions) {
    const clipped = clip(sessionInterval(session, input.now), from, to);
    if (clipped === null) {
      continue;
    }
    declaredIntervals.push(clipped);
    declaredGroups.get(session.activityId)?.intervals.push(clipped);
  }

  const verifiedGroups = new Map<string, { label: string; intervals: Interval[] }>();
  const verifiedIntervals: Interval[] = [];
  for (const sample of input.healthSamples) {
    const clipped = clip(sampleInterval(sample), from, to);
    if (clipped === null) {
      continue;
    }
    verifiedIntervals.push(clipped);
    const key = ROW_KEY.health(sample.type);
    const group = verifiedGroups.get(key) ?? { label: HEALTH_LABELS[sample.type], intervals: [] };
    group.intervals.push(clipped);
    verifiedGroups.set(key, group);
  }

  // Rows are keyed by activity key, not id, so the UI has a stable identity.
  const declaredByKey = new Map<string, { label: string; intervals: Interval[] }>();
  for (const activity of input.activities) {
    const group = declaredGroups.get(activity.id);
    if (group !== undefined && group.intervals.length > 0) {
      declaredByKey.set(ROW_KEY.activity(activity.key), group);
    }
  }

  const declared = rowsFromGroups(declaredByKey, 'declared');
  const verified = rowsFromGroups(verifiedGroups, 'verified');

  const declaredMs = unionMeasure(declaredIntervals);

  /**
   * The estimate stays out of the subtraction. It has no intervals — it comes from
   * counting thresholds — and ADR-0004 forbids presenting it as an exact figure. A
   * number that is never exact cannot take part in an exact partition.
   */
  const estimated: LedgerRow[] =
    input.usageEstimateMs > 0
      ? [
          {
            key: ROW_KEY.usage,
            label: 'redes',
            ms: input.usageEstimateMs,
            provenance: 'estimated',
          },
        ]
      : [];

  const daySoFar = Math.max(0, to - from);
  const covered = unionMeasure([...declaredIntervals, ...verifiedIntervals]);
  const unknownMs = Math.max(0, daySoFar - covered);

  const rows = [...declared, ...verified, ...estimated];
  if (unknownMs > 0) {
    rows.push({
      key: ROW_KEY.unknown,
      label: 'sin registrar',
      ms: unknownMs,
      provenance: 'unknown',
    });
  }

  return {
    rows,
    declaredMs,
    /**
     * The cap no longer protects the residual: in a partition there is no sum to
     * break, the day has the hours it has. It stays as a visible warning and as a
     * limit on the rows. See the consequences in ADR-0010.
     */
    declaredCapped: declaredMs > DECLARED_DAILY_CAP_MS,
  };
}
