import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aRunningSession, T0 } from '../../domain/fixtures';
import { endBreak, startBreak } from '../../domain/session';
import { HOUR, MINUTE } from '../../domain/time';
import { SHIELD_EVENTS_BREAKS_SQL } from '../migrations/013_shield_events_breaks';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as breaks from './breaks';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

vi.mock('../../lib/uuid', () => ({
  uuidv7: (at: number) => `id-${at}`,
}));

beforeEach(() => {
  fake = createFakeDb();
});

const at = (minutes: number) => T0 + minutes * MINUTE;

describe('follow', () => {
  it("opens a row when a break starts, from the session's own button by default", () => {
    const before = aRunningSession({ plannedMs: HOUR });
    const after = startBreak(before, at(30));

    breaks.follow(before, after);

    const insert = fake.callMatching(/INSERT INTO breaks/);
    expect(insert.params).toEqual([`id-${at(30)}`, 'session-1', at(30), 15 * MINUTE, 'session', null]);
  });

  it('opens a shield break with its app and its chosen length', () => {
    const before = aRunningSession({ plannedMs: HOUR });
    const after = startBreak(before, at(30), 5 * MINUTE);

    breaks.follow(before, after, { source: 'shield', token: 'com.instagram.android' });

    expect(fake.callMatching(/INSERT INTO breaks/).params).toEqual([
      `id-${at(30)}`,
      'session-1',
      at(30),
      5 * MINUTE,
      'shield',
      'com.instagram.android',
    ]);
  });

  it('closes the open row where the domain ended the break, however late it is noticed', () => {
    const paused = startBreak(aRunningSession({ plannedMs: HOUR }), at(30), 5 * MINUTE);
    const resumed = endBreak(paused, at(50));

    breaks.follow(paused, resumed);

    expect(fake.callMatching(/UPDATE breaks/).params).toEqual([at(35), 'session-1']);
    expect(fake.calls.some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('writes nothing when no break started or ended', () => {
    const session = aRunningSession();

    breaks.follow(session, { ...session, intention: 'leer' });

    expect(fake.calls).toHaveLength(0);
  });

  it('only inserts columns the table declares', () => {
    const before = aRunningSession({ plannedMs: HOUR });
    breaks.follow(before, startBreak(before, at(30)));

    const { table, columns } = insertColumns(fake.callMatching(/INSERT/).sql);
    const declared = ddlColumns(SHIELD_EVENTS_BREAKS_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});

describe('listBetween', () => {
  it('maps rows to records', () => {
    fake.whenSql('FROM breaks', [
      { id: 'b1', session_id: 's-1', started_at: at(30), ended_at: null, length_ms: 10 * MINUTE, source: 'shield', token: 'pkg' },
    ]);

    expect(breaks.listBetween(T0, at(60))).toEqual([
      { id: 'b1', sessionId: 's-1', startedAt: at(30), endedAt: null, lengthMs: 10 * MINUTE, source: 'shield', token: 'pkg' },
    ]);
    expect(fake.calls[0]?.params).toEqual([T0, at(60)]);
  });
});
