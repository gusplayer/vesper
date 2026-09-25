import { describe, expect, it } from 'vitest';

import { atMinuteOfDay, dayStartShifted } from '../domain/day';
import { MINUTE } from '../domain/time';
import { backupDue, mayReplace, MIN_ATTEMPT_GAP_MS, strongerTrigger, type BackupDueInput } from './backupPolicy';

/** When the automatic backup goes out (ADR-0048 §7), in the pinned time zone. */

const NOON = atMinuteOfDay(new Date(2026, 8, 25).getTime(), 12 * 60);
const YESTERDAY_NOON = atMinuteOfDay(dayStartShifted(NOON, -1), 12 * 60);

function input(overrides: Partial<BackupDueInput> = {}): BackupDueInput {
  return {
    trigger: 'front',
    now: NOON,
    lastAt: YESTERDAY_NOON,
    lastAttemptAt: 0,
    checkedDayKey: null,
    notBefore: 0,
    ...overrides,
  };
}

describe('backupDue', () => {
  it('goes on the first front of a day with no backup yet today', () => {
    expect(backupDue(input())).toBe(true);
    expect(backupDue(input({ lastAt: null }))).toBe(true);
  });

  it('waits for tomorrow on a front once today has a backup, or was checked', () => {
    expect(backupDue(input({ lastAt: NOON - 2 * 60 * MINUTE }))).toBe(false);
    expect(backupDue(input({ checkedDayKey: '2026-09-25' }))).toBe(false);
  });

  it('goes after every closed session, whatever the day says', () => {
    expect(backupDue(input({ trigger: 'session', lastAt: NOON - 60 * MINUTE, checkedDayKey: '2026-09-25' }))).toBe(true);
  });

  it('keeps five minutes between attempts, and the quiet a 429 asked for', () => {
    expect(backupDue(input({ trigger: 'session', lastAttemptAt: NOON - MIN_ATTEMPT_GAP_MS + 1 }))).toBe(false);
    expect(backupDue(input({ trigger: 'session', lastAttemptAt: NOON - MIN_ATTEMPT_GAP_MS }))).toBe(true);
    expect(backupDue(input({ trigger: 'session', notBefore: NOON + 1 }))).toBe(false);
  });
});

describe('mayReplace', () => {
  it('writes over nothing, and over the copy this install wrote or restored', () => {
    expect(mayReplace(null, null)).toBe(true);
    expect(mayReplace({ updatedAt: 100 }, 100)).toBe(true);
  });

  it('leaves a copy another install wrote alone', () => {
    expect(mayReplace({ updatedAt: 101 }, 100)).toBe(false);
    expect(mayReplace({ updatedAt: 100 }, null)).toBe(false);
  });
});

describe('strongerTrigger', () => {
  it('lets a closed session win over a front', () => {
    expect(strongerTrigger(null, 'front')).toBe('front');
    expect(strongerTrigger('front', 'session')).toBe('session');
    expect(strongerTrigger('session', 'front')).toBe('session');
  });
});
