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

function done(id: string, activityId: string, ms: number, startedAt: number): Session {
  const config: SessionConfig = {
    activityId,
    plannedMs: ms,
    depth: 'soft',
    intention: null,
    blockProfile: null,
  };
  return {
    ...createSession(id, config, startedAt),
    outcome: 'completed',
    actualMs: ms,
    endedAt: startedAt + ms,
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
    expect(declared.map((row) => row.key)).toEqual(['trabajo', 'lectura']);
    expect(declared[0]?.ms).toBe(2 * HOUR);
  });

  it('counts a running session by what it has served so far', () => {
    const running = createSession(
      's-run',
      { activityId: 'a-work', plannedMs: 2 * HOUR, depth: 'soft', intention: null, blockProfile: null },
      DAY_START,
    );
    const ledger = buildLedger(input({ sessions: [running], now: DAY_START + HOUR }));

    expect(ledger.rows.find((row) => row.key === 'trabajo')?.ms).toBe(HOUR);
  });

  it('leaves out activities with no time today', () => {
    const ledger = buildLedger(input({ sessions: [done('s-1', 'a-work', HOUR, DAY_START)] }));

    expect(ledger.rows.some((row) => row.key === 'lectura')).toBe(false);
  });
});

describe('the 6h declared cap', () => {
  it('does not touch a normal day', () => {
    const ledger = buildLedger(input({ sessions: [done('s-1', 'a-work', 3 * HOUR, DAY_START)] }));

    expect(ledger.declaredCapped).toBe(false);
    expect(ledger.declaredMs).toBe(3 * HOUR);
  });

  it('reports the real declared total even when it goes over', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-read', 8 * HOUR, DAY_START)],
        now: DAY_START + 10 * HOUR,
      }),
    );

    expect(ledger.declaredCapped).toBe(true);
    expect(ledger.declaredMs).toBe(8 * HOUR);
    // The row keeps what the user declared: the ledger is a mirror, not a judge.
    expect(ledger.rows.find((row) => row.key === 'lectura')?.ms).toBe(8 * HOUR);
  });

  it('gives the excess no credit in the day allocation', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-read', 8 * HOUR, DAY_START)],
        now: DAY_START + 10 * HOUR,
      }),
    );

    const unknown = ledger.rows.find((row) => row.key === 'unknown');
    expect(unknown?.ms).toBe(10 * HOUR - DECLARED_DAILY_CAP_MS);
  });
});

describe('verified rows', () => {
  const workout: HealthSample = {
    id: 'h-1',
    externalId: 'ext-1',
    type: 'workout',
    value: 1,
    unit: 'count',
    startedAt: DAY_START + HOUR,
    endedAt: DAY_START + 2 * HOUR,
    sourceName: 'Apple Watch',
  };

  it('are labelled and never capped', () => {
    const ledger = buildLedger(input({ healthSamples: [workout] }));
    const row = ledger.rows.find((r) => r.provenance === 'verified');

    expect(row?.label).toBe('entrenamiento');
    expect(row?.ms).toBe(HOUR);
  });

  it('clip a sample that crosses midnight to the day window', () => {
    const sleep: HealthSample = {
      ...workout,
      id: 'h-2',
      type: 'sleep',
      startedAt: DAY_START - 3 * HOUR,
      endedAt: DAY_START + 5 * HOUR,
    };
    const ledger = buildLedger(input({ healthSamples: [sleep] }));

    expect(ledger.rows.find((row) => row.key === 'sleep')?.ms).toBe(5 * HOUR);
  });
});

describe('sin registrar', () => {
  it('is the rest of the day so far, not the rest of the day', () => {
    const ledger = buildLedger(
      input({ sessions: [done('s-1', 'a-work', 2 * HOUR, DAY_START)], now: DAY_START + 8 * HOUR }),
    );

    // 8h into the day with 2h recorded: 6h unregistered, not 22h.
    expect(ledger.rows.find((row) => row.key === 'unknown')?.ms).toBe(6 * HOUR);
  });

  it('uses the real day length, so a 23h DST day does not invent an hour', () => {
    const ledger = buildLedger(
      input({ dayEnd: DAY_START + 23 * HOUR, now: DAY_START + 30 * HOUR }),
    );

    expect(ledger.rows.find((row) => row.key === 'unknown')?.ms).toBe(23 * HOUR);
  });

  it('floors at zero instead of going negative', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-work', 5 * HOUR, DAY_START)],
        now: DAY_START + 2 * HOUR,
      }),
    );

    expect(ledger.rows.find((row) => row.key === 'unknown')).toBeUndefined();
  });
});

describe('estimated row', () => {
  it('only appears when there is an estimate, which is 0 in phase 1', () => {
    expect(buildLedger(input()).rows.some((row) => row.provenance === 'estimated')).toBe(false);
    expect(
      buildLedger(input({ usageEstimateMs: HOUR })).rows.some(
        (row) => row.provenance === 'estimated',
      ),
    ).toBe(true);
  });
});

describe('provenance', () => {
  it('is carried by every row, so nothing can be summed by accident', () => {
    const ledger = buildLedger(
      input({
        sessions: [done('s-1', 'a-work', HOUR, DAY_START)],
        healthSamples: [
          {
            id: 'h-1',
            externalId: 'ext-1',
            type: 'workout',
            value: 1,
            unit: 'count',
            startedAt: DAY_START + HOUR,
            endedAt: DAY_START + 2 * HOUR,
            sourceName: null,
          },
        ],
        usageEstimateMs: HOUR,
      }),
    );

    expect(new Set(ledger.rows.map((row) => row.provenance))).toEqual(
      new Set(['declared', 'verified', 'estimated', 'unknown']),
    );
  });
});
