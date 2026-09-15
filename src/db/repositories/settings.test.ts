import { beforeEach, describe, expect, it, vi } from 'vitest';

import { INIT_SQL } from '../migrations/001_init';
import { createFakeDb, ddlColumns, insertColumns } from '../testing/fakeDb';
import * as settings from './settings';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
}));

const T0 = 1_700_000_000_000;

beforeEach(() => {
  fake = createFakeDb();
});

describe('get', () => {
  it('is null for a missing key', () => {
    expect(settings.get('missing')).toBeNull();
    expect(fake.callMatching('SELECT value FROM settings').params).toEqual(['missing']);
  });

  it('is null when the stored value is not a string', () => {
    fake.whenSql('SELECT value', [{ value: 5 }]);

    expect(settings.get('k')).toBeNull();
  });

  it('returns the stored string', () => {
    fake.whenSql('SELECT value', [{ value: 'hola' }]);

    expect(settings.get('k')).toBe('hola');
  });
});

describe('getNumber', () => {
  it('is null for text that is not a number', () => {
    fake.whenSql('SELECT value', [{ value: 'abc' }]);

    expect(settings.getNumber('k')).toBeNull();
  });

  it('parses a stored number', () => {
    fake.whenSql('SELECT value', [{ value: '77.6' }]);

    expect(settings.getNumber('k')).toBe(77.6);
  });
});

describe('getJson', () => {
  it('is null on corrupt JSON instead of throwing', () => {
    fake.whenSql('SELECT value', [{ value: '{not json' }]);

    expect(settings.getJson('k')).toBeNull();
  });

  it('parses stored JSON', () => {
    fake.whenSql('SELECT value', [{ value: '{"depth":"soft"}' }]);

    expect(settings.getJson('k')).toEqual({ depth: 'soft' });
  });
});

describe('set', () => {
  it('upserts on the key', () => {
    settings.set('k', 'v', T0);

    const call = fake.callMatching(/INSERT INTO settings/);
    expect(call.sql).toContain('ON CONFLICT(key) DO UPDATE');
    expect(call.params).toEqual(['k', 'v', T0]);
  });

  it('serialises numbers and JSON as text', () => {
    settings.setNumber('n', 42, T0);
    settings.setJson('j', { a: 1 }, T0);

    const [first, second] = fake.calls;
    expect(first?.params).toEqual(['n', '42', T0]);
    expect(second?.params).toEqual(['j', '{"a":1}', T0]);
  });
});

describe('getWeeklyTargetMs', () => {
  it('is null when missing, zero or negative', () => {
    expect(settings.getWeeklyTargetMs()).toBeNull();

    fake = createFakeDb();
    fake.whenSql('SELECT value', [{ value: '0' }]);
    expect(settings.getWeeklyTargetMs()).toBeNull();

    fake = createFakeDb();
    fake.whenSql('SELECT value', [{ value: '-5' }]);
    expect(settings.getWeeklyTargetMs()).toBeNull();
  });

  it('returns the stored target otherwise', () => {
    fake.whenSql('SELECT value', [{ value: '36000000' }]);

    expect(settings.getWeeklyTargetMs()).toBe(36_000_000);
    expect(fake.callMatching('SELECT value').params).toEqual([
      settings.SETTING_KEYS.weeklyFocusTargetMs,
    ]);
  });
});

describe('setWeeklyTargetMs', () => {
  it('writes 0 for no goal', () => {
    settings.setWeeklyTargetMs(null, T0);

    expect(fake.callMatching(/INSERT INTO settings/).params).toEqual([
      settings.SETTING_KEYS.weeklyFocusTargetMs,
      '0',
      T0,
    ]);
  });

  it('writes the target otherwise', () => {
    settings.setWeeklyTargetMs(36_000_000, T0);

    expect(fake.callMatching(/INSERT INTO settings/).params?.[1]).toBe('36000000');
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the settings table', () => {
    settings.set('k', 'v', T0);

    const { table, columns } = insertColumns(fake.callMatching(/INSERT/).sql);
    expect(table).toBe('settings');
    const declared = ddlColumns(INIT_SQL, table);
    for (const column of columns) {
      expect(declared).toContain(column);
    }
  });
});
