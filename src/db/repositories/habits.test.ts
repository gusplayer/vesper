import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INIT_SQL } from '../migrations/001_init';
import { createFakeDb, ddlColumns, insertColumns, transactionOn, type FakeRows } from '../testing/fakeDb';
import * as habits from './habits';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
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

beforeEach(() => {
  fake = createFakeDb();
});

describe('upsert', () => {
  it('writes the whole habit in column order and updates every column but created_at on conflict', () => {
    habits.upsert({
      id: 'habit-gym',
      name: 'gym',
      activityId: 'activity-gym',
      weeklyTarget: 4,
      countMode: 'verified',
      healthType: 'workout',
      archivedAt: null,
      createdAt: T0,
    });

    const call = fake.callMatching(/INSERT INTO habits/);
    expect(call.sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(call.sql).not.toMatch(/created_at = excluded/);
    expect(call.params).toEqual(['habit-gym', 'gym', 'activity-gym', 4, 'verified', 'workout', null, T0]);
  });

  it('refuses a sixth active habit before touching the table, like insert (rule 4)', () => {
    fake.whenSql(/FROM habits WHERE id = \?/, []);
    fake.whenSql(/COUNT\(\*\)/, [{ n: 5 }]);

    expect(() => habits.upsert(aRow('h-6'))).toThrow(/more than 5/);
    expect(fake.calls.some((call) => call.sql.includes('INSERT'))).toBe(false);
  });

  it('counts an archived habit coming back as a new slot', () => {
    fake.whenSql(/FROM habits WHERE id = \?/, [{ ...aHabitRow('h-old'), archived_at: T0 }]);
    fake.whenSql(/COUNT\(\*\)/, [{ n: 5 }]);

    expect(() => habits.upsert(aRow('h-old'))).toThrow(/more than 5/);
  });

  it('edits an active habit, and archives one, at the cap without counting', () => {
    fake.whenSql(/FROM habits WHERE id = \?/, [aHabitRow('h-1')]);
    fake.whenSql(/COUNT\(\*\)/, [{ n: 5 }]);

    habits.upsert({ ...aRow('h-1'), name: 'gym' });
    habits.upsert({ ...aRow('h-1'), archivedAt: T0 });

    expect(fake.calls.filter((call) => call.sql.includes('INSERT INTO habits'))).toHaveLength(2);
    expect(fake.calls.some((call) => call.sql.includes('COUNT'))).toBe(false);
  });

  it('writes a new habit under the cap, and does not check the name: the editor already did', () => {
    fake.whenSql(/COUNT\(\*\)/, [{ n: 4 }]);

    habits.upsert({ ...aRow('h'), name: '' });

    expect(fake.callMatching(/INSERT INTO habits/).params?.[1]).toBe('');
  });
});

function aRow(id: string): Parameters<typeof habits.upsert>[0] {
  return {
    id,
    name: 'leer',
    activityId: null,
    weeklyTarget: 4,
    countMode: 'declared',
    healthType: null,
    archivedAt: null,
    createdAt: T0,
  };
}

function aHabitRow(id: string): Record<string, unknown> {
  return {
    id,
    name: 'leer',
    activity_id: null,
    weekly_target: 4,
    count_mode: 'declared',
    health_type: null,
    archived_at: null,
    created_at: T0,
  };
}

describe('replaceHealthMarks', () => {
  it('deletes every health mark, then inserts the given ones with their own ids', () => {
    habits.replaceHealthMarks([
      {
        id: 'hk-1',
        habitId: 'habit-gym',
        dayKey: '2026-08-17',
        source: 'health',
        sourceRef: 'sample-1',
        durationMs: 1_800_000,
        markedAt: T0,
      },
    ]);

    const [begin, first, second, commit] = fake.calls;
    expect(begin?.sql).toBe('BEGIN');
    expect(first?.sql).toMatch(/DELETE FROM habit_marks WHERE source = 'health'/);
    expect(second?.sql).toContain('INSERT OR IGNORE INTO habit_marks');
    expect(second?.params).toEqual(['hk-1', 'habit-gym', '2026-08-17', 'health', 'sample-1', 1_800_000, T0]);
    expect(commit?.sql).toBe('COMMIT');
  });

  it('only deletes when given nothing, still inside a transaction', () => {
    habits.replaceHealthMarks([]);

    expect(fake.calls.map((call) => call.sql.split(' ')[0])).toEqual(['BEGIN', 'DELETE', 'COMMIT']);
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
    habits.mark({ habitId: 'habit-1', dayKey: '2026-08-17', source: 'manual' }, T0);
    habits.upsert({
      id: 'h',
      name: 'gym',
      activityId: null,
      weeklyTarget: 1,
      countMode: 'declared',
      healthType: null,
      archivedAt: null,
      createdAt: T0,
    });
    habits.replaceHealthMarks([
      { id: 'hk', habitId: 'h', dayKey: '2026-08-17', source: 'health', sourceRef: 'r', durationMs: null, markedAt: T0 },
    ]);

    const inserts = fake.calls.filter((call) => call.sql.includes('INSERT'));
    expect(inserts).toHaveLength(3);
    for (const call of inserts) {
      const { table, columns } = insertColumns(call.sql);
      const declared = ddlColumns(INIT_SQL, table);
      for (const column of columns) {
        expect(declared).toContain(column);
      }
    }
  });
});
