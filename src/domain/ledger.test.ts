import { describe, expect, it } from 'vitest';

import { buildLedger } from './ledger';
import { createSession, type SessionConfig } from './session';
import {
  DECLARED_DAILY_CAP_MS,
  type Activity,
  type HealthSample,
  type LedgerInput,
  type Session,
} from './types';

const HOUR = 3_600_000;
const DAY_START = 1_700_000_000_000;
const DAY_END = DAY_START + 24 * HOUR;

const activities: Activity[] = [
  { id: 'a-work', key: 'trabajo', label: 'trabajo', isDefault: true, archivedAt: null, createdAt: 0 },
  { id: 'a-read', key: 'lectura', label: 'lectura', isDefault: true, archivedAt: null, createdAt: 0 },
];

/** A finished session that served exactly `ms` starting at `startedAt`. */
function done(id: string, activityId: string, ms: number, startedAt: number): Session {
  const config: SessionConfig = {
    activityId,
    plannedMs: ms,
    depth: 'soft',
    blockProfile: null,
  };
  return {
    ...createSession(id, config, startedAt),
    outcome: 'completed',
    actualMs: ms,
    endedAt: startedAt + ms,
  };
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

function rowMs(ledger: ReturnType<typeof buildLedger>, key: string): number | undefined {
  return ledger.rows.find((row) => row.key === key)?.ms;
}

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
    const running = createSession(
      's-run',
      { activityId: 'a-work', plannedMs: 2 * HOUR, depth: 'soft', blockProfile: null },
      DAY_START,
    );
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
});

describe('verified rows', () => {
  it('are labelled and never capped', () => {
    const workout = sample('h-1', 'workout', DAY_START + HOUR, DAY_START + 2 * HOUR);
    const ledger = buildLedger(input({ healthSamples: [workout] }));
    const row = ledger.rows.find((r) => r.provenance === 'verified');

    expect(row?.label).toBe('entrenamiento');
    expect(row?.ms).toBe(HOUR);
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
        healthSamples: [sample('h-1', 'workout', DAY_START + 30 * 60_000, DAY_START + HOUR)],
        now: DAY_START + 8 * HOUR,
      }),
    );

    // The overlapping half hour is inside the session, so the day is covered by 2h.
    expect(rowMs(ledger, 'unknown')).toBe(6 * HOUR);
    // And each row still reports its own real total.
    expect(rowMs(ledger, 'activity:trabajo')).toBe(2 * HOUR);
    expect(rowMs(ledger, 'health:workout')).toBe(30 * 60_000);
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
  it('is carried by every row, so nothing can be summed by accident', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-work', HOUR, DAY_START)],
        healthSamples: [sample('h-1', 'workout', DAY_START + 2 * HOUR, DAY_START + 3 * HOUR)],
        usageEstimateMs: HOUR,
      }),
    );

    expect(new Set(ledger.rows.map((row) => row.provenance))).toEqual(
      new Set(['declared', 'verified', 'estimated', 'unknown']),
    );
  });
});
