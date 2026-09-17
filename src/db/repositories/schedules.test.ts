import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Schedule } from '../../data/types';
import { MODES_SQL } from '../migrations/002_modes_schedules';
import { ROUTINES_SQL } from '../migrations/003_routines';
import { SCHEDULE_STAMPS_SQL } from '../migrations/006_schedule_stamps';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as schedules from './schedules';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

const T0 = 1_700_000_000_000;

const schedule: Schedule = {
  id: 'schedule-1',
  name: 'Trabajo',
  modeId: 'mode-1',
  startMinutes: 9 * 60,
  endMinutes: null,
  durationMs: null,
  days: [true, true, true, true, true, false, false],
  enabled: true,
  updatedAt: T0,
};

const row = {
  id: 'schedule-1',
  name: 'Trabajo',
  mode_id: 'mode-1',
  start_minutes: 9 * 60,
  end_minutes: null,
  days: '[true,true,true,true,true,false,false]',
  enabled: 1,
  created_at: T0,
  updated_at: T0,
};

beforeEach(() => {
  fake = createFakeDb();
});

describe('parseDays', () => {
  it('reads seven booleans, treating anything but true as false', () => {
    expect(schedules.parseDays('[true,false,true,1,"x",null,true]')).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('is all false for corrupt JSON, the wrong length or a non-string', () => {
    const none = [false, false, false, false, false, false, false];
    expect(schedules.parseDays('[true')).toEqual(none);
    expect(schedules.parseDays('[true,true]')).toEqual(none);
    expect(schedules.parseDays(7)).toEqual(none);
  });
});

describe('list', () => {
  it('maps rows, reading enabled as a boolean, days from JSON and the save stamp', () => {
    fake.whenSql('ORDER BY created_at', [
      row,
      { ...row, id: 'schedule-2', enabled: 0, end_minutes: 600, updated_at: T0 + 5 },
    ]);

    const listed = schedules.list();

    expect(listed[0]).toEqual(schedule);
    expect(listed[1]).toMatchObject({ id: 'schedule-2', enabled: false, endMinutes: 600, updatedAt: T0 + 5 });
  });

  it('is empty without rows', () => {
    expect(schedules.list()).toEqual([]);
  });
});

describe('upsert', () => {
  it('writes the params in column order, days as JSON, enabled as 0/1, and stamps now', () => {
    // The stamp is the write's, not the object's: a stale updatedAt never survives a save.
    schedules.upsert({ ...schedule, updatedAt: 1 }, T0);

    const call = fake.callMatching(/INSERT INTO schedules/);
    expect(call.sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(insertColumns(call.sql).columns).toEqual([
      'id',
      'name',
      'mode_id',
      'start_minutes',
      'end_minutes',
      'duration_ms',
      'days',
      'enabled',
      'created_at',
      'updated_at',
    ]);
    expect(call.params).toEqual([
      'schedule-1',
      'Trabajo',
      'mode-1',
      540,
      null,
      null,
      '[true,true,true,true,true,false,false]',
      1,
      T0,
      T0,
    ]);
    expect(call.sql).not.toMatch(/created_at = excluded/);
    expect(call.sql).toMatch(/updated_at = excluded\.updated_at/);
  });

  it('writes 0 for a disabled schedule', () => {
    schedules.upsert({ ...schedule, enabled: false }, T0);

    expect(fake.callMatching(/INSERT INTO schedules/).params?.[7]).toBe(0);
  });
});

describe('setEnabled / disableByMode / touchAll / remove', () => {
  it('issue UPDATEs that stamp now, and a DELETE with the id last', () => {
    schedules.setEnabled('schedule-1', false, T0);
    schedules.disableByMode('mode-1', T0 + 1);
    schedules.touchAll(T0 + 2);
    schedules.remove('schedule-1');

    expect(fake.callMatching('SET enabled = ?, updated_at = ? WHERE id = ?').params).toEqual([0, T0, 'schedule-1']);
    expect(fake.callMatching('SET enabled = 0, updated_at = ? WHERE mode_id = ?').params).toEqual([T0 + 1, 'mode-1']);
    const touch = fake.callMatching(/SET updated_at = \?$/);
    expect(touch.params).toEqual([T0 + 2]);
    expect(touch.sql).not.toContain('WHERE');
    expect(fake.callMatching(/DELETE FROM schedules/).params).toEqual(['schedule-1']);
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the schedules table', () => {
    schedules.upsert(schedule, T0);

    const { table, columns } = insertColumns(fake.callMatching(/INSERT/).sql);
    expect(table).toBe('schedules');
    const declared = ddlColumns(MODES_SQL + ROUTINES_SQL + SCHEDULE_STAMPS_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});
