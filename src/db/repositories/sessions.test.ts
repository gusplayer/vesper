import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aDoneSession, aRunningSession, T0 } from '../../domain/fixtures';
import { BREAK_EVERY_MS, BREAK_MS } from '../../domain/session';
import { HOUR, MINUTE } from '../../domain/time';
import { INIT_SQL } from '../migrations/001_init';
import { OPEN_SESSIONS_BREAKS_SQL } from '../migrations/005_open_sessions_breaks';
import { KEYS_SQL } from '../migrations/008_keys';
import { DICTATED_CODE_SQL } from '../migrations/010_dictated_code';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as sessions from './sessions';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

function runningRow(id: string, startedAt: number, plannedMs: number, extra: Record<string, unknown> = {}) {
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
    open: 0,
    break_ms: 0,
    break_started_at: null,
    next_break_at_ms: BREAK_EVERY_MS,
    key_id: null,
    key_step: null,
    key_tries: 0,
    ...extra,
  };
}

beforeEach(() => {
  fake = createFakeDb();
});

describe('insert', () => {
  it('refuses a running session while another runs: invariant 1 in the table', () => {
    fake.whenSql("outcome = 'running'", [runningRow('s-other', T0, HOUR)]);

    expect(() => sessions.insert(aRunningSession())).toThrow(/already running/);
    expect(fake.calls.some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('inserts a closed session without looking for a running one', () => {
    sessions.insert(aDoneSession(HOUR));

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.sql).toContain('INSERT INTO sessions');
  });

  it('writes the 19 params in column order', () => {
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
      'open',
      'break_ms',
      'break_started_at',
      'next_break_at_ms',
      'key_id',
      'key_step',
      'key_tries',
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
      0,
      0,
      null,
      BREAK_EVERY_MS,
      null,
      null,
      0,
    ]);
    expect(call.params).toHaveLength(19);
  });
});

describe('update', () => {
  it('writes the mutable columns, intention and breaks included, then the id', () => {
    const closed = aDoneSession(HOUR, T0, {
      outcome: 'cancelled',
      actualMs: HOUR / 2,
      exitReason: 'llamada',
      interruptions: 3,
      intention: 'leer',
      breakMs: 10 * MINUTE,
      nextBreakAtMs: 55 * MINUTE,
    });

    sessions.update(closed);

    const call = fake.callMatching(/UPDATE sessions/);
    expect(call.sql).toMatch(
      /SET actual_ms = \?, outcome = \?, exit_reason = \?, interruptions = \?, ended_at = \?,\s+intention = \?, break_ms = \?, break_started_at = \?, next_break_at_ms = \?,\s+key_tries = \?/,
    );
    expect(call.params).toEqual([
      HOUR / 2,
      'cancelled',
      'llamada',
      3,
      T0 + HOUR,
      'leer',
      10 * MINUTE,
      null,
      55 * MINUTE,
      0,
      'session-1',
    ]);
  });
});

describe('countCompleted', () => {
  it('reads the COUNT and defaults to zero', () => {
    expect(sessions.countCompleted()).toBe(0);
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
      open: false,
      breakMs: 0,
      breakStartedAt: null,
      nextBreakAtMs: BREAK_EVERY_MS,
      keyId: null,
      keyStep: null,
      keyTries: 0,
    });
  });

  it('reads the open flag as a boolean', () => {
    fake.whenSql("outcome = 'running'", [runningRow('s-open', T0, 12 * HOUR, { open: 1 })]);

    expect(sessions.findRunning()?.open).toBe(true);
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
  it('completes each chosen-duration orphan at its planned end and returns the count', () => {
    fake.whenSql("outcome = 'running'", [runningRow('s-1', T0, HOUR), runningRow('s-2', T0 + HOUR, 2 * HOUR)]);

    const recovered = sessions.recoverOrphans(T0 + 10 * HOUR);

    expect(recovered).toBe(2);

    const updates = fake.calls.filter((call) => call.sql.includes('UPDATE sessions'));
    expect(updates).toHaveLength(2);
    expect(updates[0]?.params).toEqual([HOUR, 'completed', null, 2, T0 + HOUR, 'leer', 0, null, BREAK_EVERY_MS, 0, 's-1']);
    expect(updates[1]?.params).toEqual([2 * HOUR, 'completed', null, 2, T0 + 3 * HOUR, 'leer', 0, null, BREAK_EVERY_MS, 0, 's-2']);
  });

  it('expires an open orphan at its 12 h cap: the one case that earns expired', () => {
    fake.whenSql("outcome = 'running'", [runningRow('s-open', T0, 12 * HOUR, { open: 1 })]);

    expect(sessions.recoverOrphans(T0 + 20 * HOUR)).toBe(1);
    expect(fake.callMatching(/UPDATE sessions/).params?.slice(0, 2)).toEqual([12 * HOUR, 'expired']);
    expect(fake.callMatching(/UPDATE sessions/).params?.[4]).toBe(T0 + 12 * HOUR);
  });

  it('leaves a session still inside its window alone', () => {
    fake.whenSql("outcome = 'running'", [runningRow('s-1', T0, HOUR)]);

    expect(sessions.recoverOrphans(T0 + 10 * MINUTE)).toBe(0);
    expect(fake.calls.some((call) => call.sql.includes('UPDATE'))).toBe(false);
  });

  it('ends a break past its length and keeps the session running', () => {
    fake.whenSql("outcome = 'running'", [
      runningRow('s-1', T0, HOUR, { break_started_at: T0 + 30 * MINUTE, next_break_at_ms: 25 * MINUTE }),
    ]);

    const expired = sessions.recoverOrphans(T0 + 50 * MINUTE);

    expect(expired).toBe(0);
    const update = fake.callMatching(/UPDATE sessions/);
    // Ended at its own end: 15 min on record, the clock frozen at 30 min of focus.
    expect(update.params).toEqual([0, 'running', null, 2, null, 'leer', BREAK_MS, null, 30 * MINUTE + BREAK_EVERY_MS, 0, 's-1']);
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
    const declared = ddlColumns(INIT_SQL + OPEN_SESSIONS_BREAKS_SQL + KEYS_SQL + DICTATED_CODE_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});
