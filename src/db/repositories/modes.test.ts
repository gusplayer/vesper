import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Mode } from '../../data/types';
import { MODES_SQL } from '../migrations/002_modes_schedules';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as modes from './modes';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

const mode: Mode = {
  id: 'mode-1',
  name: 'Sin redes',
  behavior: 'block',
  appIds: ['instagram', 'tiktok'],
  websiteIds: ['x.com'],
  depth: 'firm',
  activityId: 'trabajo',
  selectionToken: null,
  createdAt: 10,
};

const row = {
  id: 'mode-1',
  name: 'Sin redes',
  behavior: 'block',
  app_ids: '["instagram","tiktok"]',
  website_ids: '["x.com"]',
  depth: 'firm',
  activity_id: 'trabajo',
  selection_token: null,
  created_at: 10,
};

beforeEach(() => {
  fake = createFakeDb();
});

describe('parseStringList', () => {
  it('reads a JSON array of strings and drops anything else', () => {
    expect(modes.parseStringList('["a","b"]')).toEqual(['a', 'b']);
    expect(modes.parseStringList('["a",1,null]')).toEqual(['a']);
  });

  it('is empty for corrupt JSON, a non-array or a non-string', () => {
    expect(modes.parseStringList('{not json')).toEqual([]);
    expect(modes.parseStringList('{"a":1}')).toEqual([]);
    expect(modes.parseStringList(null)).toEqual([]);
  });
});

describe('list / findById', () => {
  it('maps rows, parsing the JSON lists', () => {
    fake.whenSql('ORDER BY created_at', [row, { ...row, id: 'mode-2', selection_token: 'tok' }]);

    const listed = modes.list();

    expect(listed).toHaveLength(2);
    expect(listed[0]).toEqual(mode);
    expect(listed[1]?.selectionToken).toBe('tok');
  });

  it('falls back to block and soft for unknown behavior and depth', () => {
    fake.whenSql('id = ?', [{ ...row, behavior: 'weird', depth: 'weird' }]);

    const found = modes.findById('mode-1');

    expect(found?.behavior).toBe('block');
    expect(found?.depth).toBe('soft');
    expect(fake.callMatching('id = ?').params).toEqual(['mode-1']);
  });

  it('is null when there is no row', () => {
    expect(modes.findById('missing')).toBeNull();
  });
});

describe('upsert', () => {
  it('writes the params in column order, with the lists as JSON', () => {
    modes.upsert(mode);

    const call = fake.callMatching(/INSERT INTO modes/);
    expect(call.sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(insertColumns(call.sql).columns).toEqual([
      'id',
      'name',
      'behavior',
      'app_ids',
      'website_ids',
      'depth',
      'activity_id',
      'selection_token',
      'created_at',
    ]);
    expect(call.params).toEqual([
      'mode-1',
      'Sin redes',
      'block',
      '["instagram","tiktok"]',
      '["x.com"]',
      'firm',
      'trabajo',
      null,
      10,
    ]);
  });

  it('keeps created_at on conflict', () => {
    modes.upsert(mode);

    expect(fake.callMatching(/INSERT INTO modes/).sql).not.toMatch(/created_at = excluded/);
  });
});

describe('setSelectionToken / remove', () => {
  it('issue an UPDATE and a DELETE with the id last', () => {
    modes.setSelectionToken('mode-1', 'tok');
    modes.setSelectionToken('mode-1', null);
    modes.remove('mode-1');

    const updates = fake.calls.filter((call) => call.sql.includes('SET selection_token'));
    expect(updates.map((call) => call.params)).toEqual([
      ['tok', 'mode-1'],
      [null, 'mode-1'],
    ]);
    expect(fake.callMatching(/DELETE FROM modes/).params).toEqual(['mode-1']);
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the modes table', () => {
    modes.upsert(mode);

    const { table, columns } = insertColumns(fake.callMatching(/INSERT/).sql);
    expect(table).toBe('modes');
    const declared = ddlColumns(MODES_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});
