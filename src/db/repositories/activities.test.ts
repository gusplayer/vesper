import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INIT_SQL } from '../migrations/001_init';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as activities from './activities';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

vi.mock('../../lib/uuid', () => ({
  uuidv7: () => 'id-fixed',
}));

const T0 = 1_700_000_000_000;

const workRow = {
  id: 'activity-work',
  key: 'trabajo',
  label: 'trabajo',
  is_default: 1,
  archived_at: null,
  created_at: 0,
};

beforeEach(() => {
  fake = createFakeDb();
});

describe('listActive', () => {
  it('maps rows to activities, reading is_default as a boolean', () => {
    fake.whenSql('archived_at IS NULL', [workRow, { ...workRow, id: 'a2', key: 'x', is_default: 0 }]);

    const listed = activities.listActive();

    expect(listed).toHaveLength(2);
    expect(listed[0]).toEqual({
      id: 'activity-work',
      key: 'trabajo',
      label: 'trabajo',
      isDefault: true,
      archivedAt: null,
      createdAt: 0,
    });
    expect(listed[1]?.isDefault).toBe(false);
  });
});

describe('findById / findByKey', () => {
  it('are null when there is no row', () => {
    expect(activities.findById('missing')).toBeNull();
    expect(activities.findByKey('missing')).toBeNull();
    expect(fake.callMatching('id = ?').params).toEqual(['missing']);
    expect(fake.callMatching('key = ?').params).toEqual(['missing']);
  });

  it('map the row when there is one', () => {
    fake.whenSql('key = ?', [workRow]);

    expect(activities.findByKey('trabajo')?.id).toBe('activity-work');
  });
});

describe('insert', () => {
  it('runs one INSERT with the params in column order and returns the activity', () => {
    const created = activities.insert('gym', 'Gym', T0);

    expect(created).toEqual({
      id: 'id-fixed',
      key: 'gym',
      label: 'Gym',
      isDefault: false,
      archivedAt: null,
      createdAt: T0,
    });
    expect(fake.calls).toHaveLength(1);
    const call = fake.callMatching(/^INSERT INTO activities/);
    expect(call.params).toEqual(['id-fixed', 'gym', 'Gym', T0]);
  });
});

describe('seedDefaults', () => {
  it('issues one INSERT OR IGNORE per default activity', () => {
    activities.seedDefaults(T0);

    expect(fake.calls).toHaveLength(6);
    for (const call of fake.calls) {
      expect(call.sql.trim().startsWith('INSERT OR IGNORE INTO activities')).toBe(true);
      expect(call.params?.[0]).toBe('id-fixed');
      expect(call.params?.[3]).toBe(T0);
    }
    expect(fake.calls.map((call) => call.params?.[1])).toEqual([
      'trabajo',
      'lectura',
      'aprender',
      'gym',
      'familia',
      'amigos',
    ]);
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the activities table', () => {
    activities.insert('gym', 'gym', T0);
    activities.seedDefaults(T0);

    const declared = ddlColumns(INIT_SQL, 'activities');
    for (const call of fake.calls) {
      const { table, columns } = insertColumns(call.sql);
      expect(table).toBe('activities');
      for (const column of columns) {
        expect(declared).toContain(column);
      }
    }
  });
});
