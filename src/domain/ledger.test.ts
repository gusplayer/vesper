import { describe, expect, it } from 'vitest';

import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { aDoneSession, anActivity, aRunningSession, T0 } from './fixtures';
import { buildLedger as build } from './ledger';
import { HOUR, MINUTE } from './time';
import {
  DECLARED_DAILY_CAP_MS,
  type Activity,
  type HealthSample,
  type LedgerInput,
  type Session,
} from './types';

const DAY_START = T0;
const DAY_END = DAY_START + 24 * HOUR;

const activities: Activity[] = [
  anActivity({ id: 'a-work', key: 'trabajo', label: 'trabajo' }),
  anActivity({ id: 'a-read', key: 'lectura', label: 'lectura' }),
];

/** A finished session that served exactly `ms` starting at `startedAt`. */
function done(id: string, activityId: string, ms: number, startedAt: number): Session {
  return aDoneSession(ms, startedAt, { id, activityId });
}

function sample(
  id: string,
  type: HealthSample['type'],
  startedAt: number,
  endedAt: number,
): HealthSample {
  return {
    id,
    externalId: `ext-${id}`,
    type,
    value: 1,
    unit: 'count',
    startedAt,
    endedAt,
    sourceName: null,
  };
}

function input(overrides: Partial<LedgerInput> = {}): LedgerInput {
  return {
    dayStart: DAY_START,
    dayEnd: DAY_END,
    now: DAY_START + 8 * HOUR,
    activities,
    sessions: [],
    healthSamples: [],
    usageEstimateMs: 0,
    ...overrides,
  };
}

/** Every test speaks Spanish unless it is about the labels themselves. */
function buildLedger(ledgerInput: LedgerInput): ReturnType<typeof build> {
  return build(ledgerInput, es.activity.ledger);
}

function rowMs(ledger: ReturnType<typeof buildLedger>, key: string): number | undefined {
  return ledger.rows.find((row) => row.key === key)?.ms;
}

describe('the window', () => {
  it('has no rows before the day starts', () => {
    expect(buildLedger(input({ now: DAY_START - HOUR })).rows).toEqual([]);
  });

  it('has no unregistered row at the exact start of the day', () => {
    expect(buildLedger(input({ now: DAY_START })).rows).toEqual([]);
  });
});

describe('declared rows', () => {
  it('groups sessions by activity and sorts by time', () => {
    const ledger = buildLedger(
      input({
        sessions: [
          done('s-1', 'a-read', HOUR, DAY_START),
          done('s-2', 'a-work', HOUR, DAY_START + HOUR),
          done('s-3', 'a-work', HOUR, DAY_START + 2 * HOUR),
        ],
      }),
    );

    const declared = ledger.rows.filter((row) => row.provenance === 'declared');
    expect(declared.map((row) => row.key)).toEqual(['activity:trabajo', 'activity:lectura']);
    expect(declared[0]?.ms).toBe(2 * HOUR);
  });

  it('counts a running session by what it has served so far', () => {
    const running = aRunningSession({ activityId: 'a-work', plannedMs: 2 * HOUR, startedAt: DAY_START });
    const ledger = buildLedger(input({ sessions: [running], now: DAY_START + HOUR }));

    expect(rowMs(ledger, 'activity:trabajo')).toBe(HOUR);
  });

  it('credits only what a session served, not the wall clock until it was closed', () => {
    // Closed on returning from background: endedAt is an hour past the planned end.
    const session: Session = {
      ...done('s-1', 'a-work', HOUR, DAY_START),
      endedAt: DAY_START + 2 * HOUR,
    };
    const ledger = buildLedger(input({ sessions: [session] }));

    expect(rowMs(ledger, 'activity:trabajo')).toBe(HOUR);
  });

  it('leaves out activities with no time today', () => {
    const ledger = buildLedger(input({ sessions: [done('s-1', 'a-work', HOUR, DAY_START)] }));

    expect(ledger.rows.some((row) => row.key === 'activity:lectura')).toBe(false);
  });

  it('covers the clock with a session of an unknown activity, but shows no row for it', () => {
    const ledger = buildLedger(input({ sessions: [done('s-1', 'a-ghost', HOUR, DAY_START)] }));

    expect(ledger.rows.some((row) => row.provenance === 'declared')).toBe(false);
    expect(rowMs(ledger, 'unknown')).toBe(7 * HOUR);
  });

  it('clips a session that started yesterday to the day', () => {
    const ledger = buildLedger(
      input({ sessions: [done('s-1', 'a-work', 3 * HOUR, DAY_START - 2 * HOUR)] }),
    );

    expect(rowMs(ledger, 'activity:trabajo')).toBe(HOUR);
  });

  it('drops a session in the future', () => {
    const ledger = buildLedger(
      input({ sessions: [done('s-1', 'a-work', HOUR, DAY_START + 10 * HOUR)] }),
    );

    expect(rowMs(ledger, 'activity:trabajo')).toBeUndefined();
    expect(rowMs(ledger, 'unknown')).toBe(8 * HOUR);
  });

  it('shows no row for a zero-length session', () => {
    const ledger = buildLedger(input({ sessions: [done('s-1', 'a-work', 0, DAY_START)] }));

    expect(rowMs(ledger, 'activity:trabajo')).toBeUndefined();
  });

  it('gives each activity its full time when two sessions overlap, and counts the union once', () => {
    const ledger = buildLedger(
      input({
        sessions: [
          done('s-1', 'a-work', HOUR, DAY_START),
          done('s-2', 'a-read', HOUR, DAY_START + 30 * MINUTE),
        ],
      }),
    );

    expect(rowMs(ledger, 'activity:trabajo')).toBe(HOUR);
    expect(rowMs(ledger, 'activity:lectura')).toBe(HOUR);
    expect(ledger.declaredMs).toBe(90 * MINUTE);
  });
});

describe('verified rows', () => {
  it('are labelled and never capped', () => {
    const workout = sample('h-1', 'workout', DAY_START + HOUR, DAY_START + 2 * HOUR);
    const ledger = buildLedger(input({ healthSamples: [workout] }));
    const row = ledger.rows.find((r) => r.provenance === 'verified');

    expect(row?.label).toBe('entrenamiento');
    expect(row?.ms).toBe(HOUR);
  });

  it('take their label from the dictionary they are given', () => {
    const workout = sample('h-1', 'workout', DAY_START + HOUR, DAY_START + 2 * HOUR);
    const ledger = build(input({ healthSamples: [workout], usageEstimateMs: HOUR }), en.activity.ledger);

    expect(ledger.rows.map((row) => row.label)).toEqual(['workout', 'social', 'unregistered']);
  });

  it('clip a sample that crosses midnight to the day window', () => {
    const sleep = sample('h-2', 'sleep', DAY_START - 3 * HOUR, DAY_START + 5 * HOUR);
    const ledger = buildLedger(input({ healthSamples: [sleep] }));

    expect(rowMs(ledger, 'health:sleep')).toBe(5 * HOUR);
  });

  it('counts two overlapping samples of the same type once', () => {
    const ledger = buildLedger(
      input({
        healthSamples: [
          sample('h-1', 'workout', DAY_START + HOUR, DAY_START + 3 * HOUR),
          sample('h-2', 'workout', DAY_START + 2 * HOUR, DAY_START + 4 * HOUR),
        ],
      }),
    );

    expect(rowMs(ledger, 'health:workout')).toBe(3 * HOUR);
  });

  it('never counts a sample that lies entirely outside the day', () => {
    const ledger = buildLedger(
      input({ healthSamples: [sample('h-1', 'workout', DAY_START - 5 * HOUR, DAY_START - HOUR)] }),
    );

    expect(ledger.rows.some((row) => row.provenance === 'verified')).toBe(false);
  });
});

describe('sin registrar', () => {
  it('is the rest of the day so far, not the rest of the day', () => {
    const ledger = buildLedger(
      input({ sessions: [done('s-1', 'a-work', 2 * HOUR, DAY_START)], now: DAY_START + 8 * HOUR }),
    );

    // 8h into the day with 2h recorded: 6h unregistered, not 22h.
    expect(rowMs(ledger, 'unknown')).toBe(6 * HOUR);
  });

  it('uses the real day length, so a 23h DST day does not invent an hour', () => {
    const ledger = buildLedger(
      input({ dayEnd: DAY_START + 23 * HOUR, now: DAY_START + 30 * HOUR }),
    );

    expect(rowMs(ledger, 'unknown')).toBe(23 * HOUR);
  });

  it('counts a verified workout inside a declared session once, not twice', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-work', 2 * HOUR, DAY_START)],
        healthSamples: [sample('h-1', 'workout', DAY_START + 30 * MINUTE, DAY_START + HOUR)],
        now: DAY_START + 8 * HOUR,
      }),
    );

    // The overlapping half hour is inside the session, so the day is covered by 2h.
    expect(rowMs(ledger, 'unknown')).toBe(6 * HOUR);
    // And each row still reports its own real total.
    expect(rowMs(ledger, 'activity:trabajo')).toBe(2 * HOUR);
    expect(rowMs(ledger, 'health:workout')).toBe(30 * MINUTE);
  });

  it('subtracts verified sleep, so documented hours are not called unregistered', () => {
    const ledger = buildLedger(
      input({
        healthSamples: [sample('h-1', 'sleep', DAY_START, DAY_START + 7 * HOUR)],
        now: DAY_START + 8 * HOUR,
      }),
    );

    expect(rowMs(ledger, 'unknown')).toBe(HOUR);
  });

  it('leaves the estimate out of the subtraction: it is a floor, not an interval', () => {
    const ledger = buildLedger(input({ usageEstimateMs: 3 * HOUR, now: DAY_START + 8 * HOUR }));

    expect(rowMs(ledger, 'usage')).toBe(3 * HOUR);
    expect(rowMs(ledger, 'unknown')).toBe(8 * HOUR);
  });

  it('disappears rather than going negative when the day is fully covered', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-work', 8 * HOUR, DAY_START)],
        now: DAY_START + 8 * HOUR,
      }),
    );

    expect(rowMs(ledger, 'unknown')).toBeUndefined();
  });
});

describe('the 6h declared cap', () => {
  it('does not fire on a normal day', () => {
    const ledger = buildLedger(input({ sessions: [done('s-1', 'a-work', 3 * HOUR, DAY_START)] }));

    expect(ledger.declaredCapped).toBe(false);
    expect(ledger.declaredMs).toBe(3 * HOUR);
  });

  it('fires one millisecond past the cap, not at it', () => {
    const at = buildLedger(
      input({ sessions: [done('s-1', 'a-read', DECLARED_DAILY_CAP_MS, DAY_START)] }),
    );
    const over = buildLedger(
      input({ sessions: [done('s-1', 'a-read', DECLARED_DAILY_CAP_MS + 1, DAY_START)] }),
    );

    expect(at.declaredCapped).toBe(false);
    expect(over.declaredCapped).toBe(true);
  });

  it('fires as a warning, reporting the real declared total', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-read', 8 * HOUR, DAY_START)],
        now: DAY_START + 10 * HOUR,
      }),
    );

    expect(ledger.declaredCapped).toBe(true);
    expect(ledger.declaredMs).toBe(8 * HOUR);
    expect(rowMs(ledger, 'activity:lectura')).toBe(8 * HOUR);
  });

  it('no longer shrinks the residual, which is now a partition — see ADR-0010', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-read', 8 * HOUR, DAY_START)],
        now: DAY_START + 10 * HOUR,
      }),
    );

    // 10h elapsed, 8h covered by the session. Before ADR-0010 the cap made this 4h.
    expect(rowMs(ledger, 'unknown')).toBe(2 * HOUR);
    expect(DECLARED_DAILY_CAP_MS).toBe(6 * HOUR);
  });
});

describe('provenance', () => {
  const full = () =>
    buildLedger(
      input({
        sessions: [done('s-1', 'a-work', HOUR, DAY_START)],
        healthSamples: [sample('h-1', 'workout', DAY_START + 2 * HOUR, DAY_START + 3 * HOUR)],
        usageEstimateMs: HOUR,
      }),
    );

  it('is carried by every row, so nothing can be summed by accident', () => {
    expect(new Set(full().rows.map((row) => row.provenance))).toEqual(
      new Set(['declared', 'verified', 'estimated', 'unknown']),
    );
  });

  it('orders rows declared, verified, estimated, unknown', () => {
    expect(full().rows.map((row) => row.provenance)).toEqual([
      'declared',
      'verified',
      'estimated',
      'unknown',
    ]);
  });

  it('namespaces row keys', () => {
    expect(full().rows.map((row) => row.key)).toEqual([
      'activity:trabajo',
      'health:workout',
      'usage',
      'unknown',
    ]);
  });

  it('keeps a user activity named unknown apart from the unregistered row', () => {
    const ledger = buildLedger(
      input({
        activities: [anActivity({ id: 'a-unk', key: 'unknown', label: 'unknown' })],
        sessions: [done('s-1', 'a-unk', HOUR, DAY_START)],
      }),
    );

    expect(rowMs(ledger, 'activity:unknown')).toBe(HOUR);
    expect(rowMs(ledger, 'unknown')).toBe(7 * HOUR);
  });
});
