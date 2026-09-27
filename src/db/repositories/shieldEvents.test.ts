import { beforeEach, describe, expect, it, vi } from 'vitest';

import { T0 } from '../../domain/fixtures';
import { MINUTE } from '../../domain/time';
import { SHIELD_EVENTS_BREAKS_SQL } from '../migrations/013_shield_events_breaks';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as shieldEvents from './shieldEvents';

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

describe('insert', () => {
  it('ties the event to the session that covered it', () => {
    fake.whenSql('FROM sessions', [{ id: 's-1' }]);

    const row = shieldEvents.insert({ kind: 'shield_hit', platform: 'android', token: 'pkg', at: T0, lengthMs: null });

    expect(row.sessionId).toBe('s-1');
    expect(fake.callMatching('FROM sessions').params).toEqual([T0, T0]);
    expect(fake.callMatching(/INSERT INTO usage_events/).params).toEqual([`id-${T0}`, 'android', 'shield_hit', 'pkg', null, 's-1', T0]);
  });

  it('keeps the chosen length only on a break, and no session when none ran', () => {
    shieldEvents.insert({ kind: 'unlock_granted', platform: 'ios', token: 'tok', at: T0, lengthMs: 10 * MINUTE });
    shieldEvents.insert({ kind: 'backed_off', platform: 'ios', token: 'tok', at: T0 + 1, lengthMs: 10 * MINUTE });

    const inserts = fake.calls.filter((call) => call.sql.includes('INSERT'));
    expect(inserts[0]?.params).toEqual([`id-${T0}`, 'ios', 'unlock_granted', 'tok', 10 * MINUTE, null, T0]);
    expect(inserts[1]?.params?.[4]).toBeNull();
  });

  it('only inserts columns the table declares', () => {
    shieldEvents.insert({ kind: 'shield_hit', platform: 'android', token: 'pkg', at: T0, lengthMs: null });

    const { table, columns } = insertColumns(fake.callMatching(/INSERT/).sql);
    const declared = ddlColumns(SHIELD_EVENTS_BREAKS_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});

describe('listBetween', () => {
  it('maps rows to events', () => {
    fake.whenSql('FROM usage_events', [
      { id: 'e1', platform: 'android', kind: 'unlock_granted', token: 'pkg', duration_ms: 5 * MINUTE, session_id: 's-1', fired_at: T0 },
    ]);

    expect(shieldEvents.listBetween(T0, T0 + MINUTE)).toEqual([
      { id: 'e1', platform: 'android', kind: 'unlock_granted', token: 'pkg', lengthMs: 5 * MINUTE, sessionId: 's-1', at: T0 },
    ]);
  });
});
