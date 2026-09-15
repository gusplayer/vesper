import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aDoneSession, aRunningSession, T0 } from '../../domain/fixtures';
import { HOUR } from '../../domain/time';
import { INIT_SQL } from '../migrations/001_init';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as sessions from './sessions';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

function runningRow(id: string, startedAt: number, plannedMs: number) {
  return {
    id,
    activity_id: 'activity-work',
    planned_ms: plannedMs,
    actual_ms: 0,
    outcome: 'running',
    depth: 'firm',
    block_profile: null,
    intention: 'leer',
    exit_reason: null,
    interruptions: 2,
    started_at: startedAt,
    ended_at: null,
  };
}

beforeEach(() => {
  fake = createFakeDb();
});

describe('insert', () => {
  it('writes the 12 params in column order', () => {
    const session = aRunningSession({ intention: 'leer', blockProfile: null });

    sessions.insert(session);

    const call = fake.callMatching(/INSERT INTO sessions/);
    expect(insertColumns(call.sql).columns).toEqual([
      'id',
      'activity_id',
      'planned_ms',
      'actual_ms',
      'outcome',
      'depth',
      'block_profile',
      'intention',
      'exit_reason',
      'interruptions',
      'started_at',
      'ended_at',
    ]);
    expect(call.params).toEqual([
      'session-1',
      'activity-work',
      HOUR,
      0,
      'running',
      'soft',
      null,
      'leer',
      null,
      0,
      T0,
      null,
    ]);
    expect(call.params).toHaveLength(12);
  });
});

describe('update', () => {
  it('writes the mutable columns, intention included, then the id', () => {
    const closed = aDoneSession(HOUR, T0, {
      outcome: 'cancelled',
      actualMs: HOUR / 2,
      exitReason: 'llamada',
      interruptions: 3,
      intention: 'leer',
    });

    sessions.update(closed);

    const call = fake.callMatching(/UPDATE sessions/);
    expect(call.sql).toMatch(
      /SET actual_ms = \?, outcome = \?, exit_reason = \?, interruptions = \?, ended_at = \?,\s+intention = \?/,
    );
    expect(call.params).toEqual([HOUR / 2, 'cancelled', 'llamada', 3, T0 + HOUR, 'leer', 'session-1']);
  });
});

describe('countCompleted / countAll', () => {
  it('read the COUNT and default to zero', () => {
    expect(sessions.countCompleted()).toBe(0);
    expect(sessions.countAll()).toBe(0);
    expect(fake.callMatching(/COUNT\(\*\)/).sql).toContain("outcome = 'completed'");

    fake = createFakeDb();
    fake.whenSql("outcome = 'completed'", [{ n: 4 }]);
    expect(sessions.countCompleted()).toBe(4);
  });
});

describe('findRunning', () => {
  it('is null when nothing is running', () => {
    expect(sessions.findRunning()).toBeNull();
    expect(fake.callMatching("outcome = 'running'").sql).toContain('LIMIT 1');
  });

  it('maps the running row', () => {
    fake.whenSql("outcome = 'running'", [runningRow('s-run', T0, HOUR)]);

    expect(sessions.findRunning()).toEqual({
      id: 's-run',
      activityId: 'activity-work',
      plannedMs: HOUR,
      actualMs: 0,
      outcome: 'running',
      depth: 'firm',
      blockProfile: null,
      intention: 'leer',
      exitReason: null,
      interruptions: 2,
      startedAt: T0,
      endedAt: null,
    });
  });
});

describe('listBetween', () => {
  it('passes from and to, in that order', () => {
    sessions.listBetween(T0, T0 + HOUR);

    const call = fake.callMatching('started_at >= ? AND started_at < ?');
    expect(call.params).toEqual([T0, T0 + HOUR]);
  });
});

describe('recoverOrphans', () => {
  it('closes each orphan as expired at its planned end and returns the count', () => {
    fake.whenSql('started_at + planned_ms <= ?', [
      runningRow('s-1', T0, HOUR),
      runningRow('s-2', T0 + HOUR, 2 * HOUR),
    ]);

    const recovered = sessions.recoverOrphans(T0 + 10 * HOUR);

    expect(recovered).toBe(2);
    expect(fake.callMatching('started_at + planned_ms <= ?').params).toEqual([T0 + 10 * HOUR]);

    const updates = fake.calls.filter((call) => call.sql.includes('UPDATE sessions'));
    expect(updates).toHaveLength(2);
    expect(updates[0]?.params).toEqual([HOUR, 'expired', null, 2, T0 + HOUR, 'leer', 's-1']);
    expect(updates[1]?.params).toEqual([2 * HOUR, 'expired', null, 2, T0 + 3 * HOUR, 'leer', 's-2']);
  });

  it('writes nothing when there is no orphan', () => {
    expect(sessions.recoverOrphans(T0)).toBe(0);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.sql).toContain('SELECT');
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the sessions table', () => {
    sessions.insert(aRunningSession());

    const { table, columns } = insertColumns(fake.callMatching(/INSERT/).sql);
    expect(table).toBe('sessions');
    const declared = ddlColumns(INIT_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});
