import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INIT_SQL } from '../migrations/001_init';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as habits from './habits';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

vi.mock('../../lib/uuid', () => ({
  uuidv7: () => 'id-fixed',
}));

const T0 = 1_700_000_000_000;

const gymActivityRow = {
  id: 'activity-gym',
  key: 'gym',
  label: 'gym',
  is_default: 1,
  archived_at: null,
  created_at: 0,
};

const newHabit: habits.NewHabit = {
  name: 'leer',
  weeklyTarget: 4,
  countMode: 'declared',
  healthType: null,
};

beforeEach(() => {
  fake = createFakeDb();
});

describe('insert', () => {
  it('refuses a sixth active habit before touching the table', () => {
    fake.whenSql(/COUNT\(\*\)/, [{ n: 5 }]);

    expect(() => habits.insert(newHabit, T0)).toThrow(/more than 5/);
    expect(fake.calls.some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('refuses an empty or whitespace name', () => {
    expect(() => habits.insert({ ...newHabit, name: '' }, T0)).toThrow(/empty/);
    expect(() => habits.insert({ ...newHabit, name: '   ' }, T0)).toThrow(/empty/);
    expect(fake.calls.some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('links the activity whose key matches the trimmed, lowercased name', () => {
    fake.whenSql('key = ?', [gymActivityRow]);

    const created = habits.insert({ ...newHabit, name: ' Gym ' }, T0);

    expect(fake.callMatching('key = ?').params).toEqual(['gym']);
    expect(created.name).toBe('Gym');
    expect(created.activityId).toBe('activity-gym');
  });

  it('leaves activity_id null when no activity matches', () => {
    const created = habits.insert(newHabit, T0);

    expect(created.activityId).toBeNull();
  });

  it('writes the params in column order and returns the habit', () => {
    const created = habits.insert(
      { name: 'gym', weeklyTarget: 2, countMode: 'verified', healthType: 'workout' },
      T0,
    );

    expect(created).toEqual({
      id: 'id-fixed',
      name: 'gym',
      activityId: null,
      weeklyTarget: 2,
      countMode: 'verified',
      healthType: 'workout',
      archivedAt: null,
      createdAt: T0,
    });
    const call = fake.callMatching(/INSERT INTO habits/);
    expect(insertColumns(call.sql).columns).toEqual([
      'id',
      'name',
      'activity_id',
      'weekly_target',
      'count_mode',
      'health_type',
      'archived_at',
      'created_at',
    ]);
    expect(call.params).toEqual(['id-fixed', 'gym', null, 2, 'verified', 'workout', T0]);
  });
});

describe('rename', () => {
  it('trims the name and re-links the activity', () => {
    fake.whenSql('key = ?', [gymActivityRow]);

    habits.rename('habit-1', '  Gym ');

    expect(fake.callMatching('key = ?').params).toEqual(['gym']);
    expect(fake.callMatching('UPDATE habits SET name').params).toEqual([
      'Gym',
      'activity-gym',
      'habit-1',
    ]);
  });

  it('refuses an empty name', () => {
    expect(() => habits.rename('habit-1', '  ')).toThrow(/empty/);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('setWeeklyTarget / archive', () => {
  it('issue an UPDATE with the id last', () => {
    habits.setWeeklyTarget('habit-1', 6);
    habits.archive('habit-1', T0);

    expect(fake.callMatching('SET weekly_target').params).toEqual([6, 'habit-1']);
    expect(fake.callMatching('SET archived_at').params).toEqual([T0, 'habit-1']);
  });
});

describe('mark', () => {
  it("stores '' as source_ref and null duration for a manual mark, idempotently", () => {
    habits.mark({ habitId: 'habit-1', dayKey: '2026-08-17', source: 'manual' }, T0);

    const call = fake.callMatching(/INSERT OR IGNORE INTO habit_marks/);
    expect(call.params).toEqual(['id-fixed', 'habit-1', '2026-08-17', 'manual', '', null, T0]);
  });

  it('keeps the source ref and duration of a health mark', () => {
    habits.mark(
      {
        habitId: 'habit-1',
        dayKey: '2026-08-17',
        source: 'health',
        sourceRef: 'sample-9',
        durationMs: 1_800_000,
      },
      T0,
    );

    expect(fake.callMatching(/INSERT OR IGNORE/).params).toEqual([
      'id-fixed',
      'habit-1',
      '2026-08-17',
      'health',
      'sample-9',
      1_800_000,
      T0,
    ]);
  });
});

describe('unmarkManual', () => {
  it('never deletes a verified mark', () => {
    habits.unmarkManual('habit-1', '2026-08-17');

    const call = fake.callMatching(/DELETE FROM habit_marks/);
    expect(call.sql).toContain("source != 'health'");
    expect(call.params).toEqual(['habit-1', '2026-08-17']);
  });
});

describe('listMarksBetween', () => {
  it('passes both keys and maps the rows', () => {
    fake.whenSql('day_key >= ?', [
      {
        id: 'm1',
        habit_id: 'habit-1',
        day_key: '2026-08-17',
        source: 'manual',
        source_ref: '',
        duration_ms: null,
        marked_at: T0,
      },
    ]);

    const marks = habits.listMarksBetween('2026-08-17', '2026-08-23');

    expect(fake.callMatching('day_key >= ?').params).toEqual(['2026-08-17', '2026-08-23']);
    expect(marks).toEqual([
      {
        id: 'm1',
        habitId: 'habit-1',
        dayKey: '2026-08-17',
        source: 'manual',
        sourceRef: '',
        durationMs: null,
        markedAt: T0,
      },
    ]);
  });
});

describe('listActive / findById / countActive', () => {
  it('map rows and default to nothing', () => {
    expect(habits.listActive()).toEqual([]);
    expect(habits.findById('missing')).toBeNull();
    expect(habits.countActive()).toBe(0);
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the habits and habit_marks tables', () => {
    habits.insert(newHabit, T0);
    habits.mark({ habitId: 'habit-1', dayKey: '2026-08-17', source: 'manual' }, T0);

    const inserts = fake.calls.filter((call) => call.sql.includes('INSERT'));
    expect(inserts).toHaveLength(2);
    for (const call of inserts) {
      const { table, columns } = insertColumns(call.sql);
      const declared = ddlColumns(INIT_SQL, table);
      for (const column of columns) {
        expect(declared).toContain(column);
      }
    }
  });
});
