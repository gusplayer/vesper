import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Settings } from '../../data/types';
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

const DEFAULTS: Settings = {
  onboardingDone: false,
  screenTimeConnected: false,
  healthConnected: false,
  notificationsAllowed: false,
  liveActivities: true,
  emergencyLeft: 5,
  emergencyTotal: 5,
  emergencyMonthKey: null,
  rules: { strictMode: false, blockInstalls: false, blockPurchases: false, blockMature: false },
  notifications: {
    coaching: true,
    updates: true,
    sessionEnd: true,
    weeklyClose: true,
    streak: true,
    noFocus: true,
    reactivation: true,
    challenges: true,
    nudges: true,
    reminderMinutes: 20 * 60,
  },
  birthDate: 700_000_000_000,
  country: null,
  sex: null,
  lifeExpectancyYears: 77.6,
  weeklyTargetMs: 54_000_000,
  pendingBanner: null,
  healthSyncedAt: null,
  lastRoutineStart: null,
  lastOpenedAt: null,
};

describe('parseSettings', () => {
  it('returns the defaults for nothing, garbage or a non-object', () => {
    expect(settings.parseSettings(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(settings.parseSettings('x', DEFAULTS)).toEqual(DEFAULTS);
    expect(settings.parseSettings([1], DEFAULTS)).toEqual(DEFAULTS);
  });

  it('keeps every well-typed field, nested ones included', () => {
    const stored: Settings = {
      ...DEFAULTS,
      onboardingDone: true,
      emergencyLeft: 2,
      rules: { ...DEFAULTS.rules, strictMode: true },
      notifications: { ...DEFAULTS.notifications, coaching: false },
      birthDate: null,
      weeklyTargetMs: null,
      pendingBanner: { title: 'Listo', message: 'Tu rutina arrancó' },
      healthSyncedAt: T0,
    };

    expect(settings.parseSettings(JSON.parse(JSON.stringify(stored)), DEFAULTS)).toEqual(stored);
  });

  it('falls back field by field, so one bad field never takes the rest down', () => {
    const parsed = settings.parseSettings(
      {
        onboardingDone: 'yes',
        emergencyLeft: 'many',
        lifeExpectancyYears: Number.NaN,
        rules: { strictMode: true, blockInstalls: 'no' },
        notifications: 'all',
        birthDate: 'ayer',
        pendingBanner: { title: 'sin mensaje' },
        healthSyncedAt: T0,
        healthConnected: true,
      },
      DEFAULTS,
    );

    expect(parsed).toEqual({
      ...DEFAULTS,
      healthConnected: true,
      rules: { ...DEFAULTS.rules, strictMode: true },
      healthSyncedAt: T0,
    });
  });

  it('ignores unknown fields instead of carrying them along', () => {
    const parsed = settings.parseSettings({ ...DEFAULTS, extra: 1 }, DEFAULTS);

    expect(Object.keys(parsed).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });
});

describe('getPrototypeSettings / setPrototypeSettings', () => {
  it('reads the JSON under prototype_settings and validates it', () => {
    fake.whenSql('SELECT value', [{ value: '{"onboardingDone":true,"emergencyLeft":"x"}' }]);

    expect(settings.getPrototypeSettings(DEFAULTS)).toEqual({ ...DEFAULTS, onboardingDone: true });
    expect(fake.callMatching('SELECT value').params).toEqual(['prototype_settings']);
  });

  it('writes the whole object as JSON under that key', () => {
    settings.setPrototypeSettings(DEFAULTS, T0);

    expect(fake.callMatching(/INSERT INTO settings/).params).toEqual([
      'prototype_settings',
      JSON.stringify(DEFAULTS),
      T0,
    ]);
  });
});

describe('getActiveModeId / setActiveModeId', () => {
  it('round-trip the id as text under active_mode_id', () => {
    expect(settings.getActiveModeId()).toBeNull();
    expect(fake.callMatching('SELECT value').params).toEqual(['active_mode_id']);

    settings.setActiveModeId('mode-1', T0);
    expect(fake.callMatching(/INSERT INTO settings/).params).toEqual(['active_mode_id', 'mode-1', T0]);
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
