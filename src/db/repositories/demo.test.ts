import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SEEDED_IDS } from '../../data/seededIds';
import { createFakeDb, transactionOn, type FakeRows } from '../testing/fakeDb';
import * as demo from './demo';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

const NOW = new Date(2026, 8, 25, 12).getTime();

beforeEach(() => {
  fake = createFakeDb();
});

/** The index of the first recorded call matching `pattern`, to assert order. */
function indexOf(pattern: RegExp): number {
  const index = fake.calls.findIndex((call) => pattern.test(call.sql));
  if (index < 0) {
    throw new Error(`no call matched ${String(pattern)}`);
  }
  return index;
}

describe('hasSeeded', () => {
  it('is false on a database with nothing seeded left', () => {
    expect(demo.hasSeeded(SEEDED_IDS)).toBe(false);
  });

  it('is true while a seeded session remains, looked up by its prefix', () => {
    fake.whenSql('FROM sessions WHERE id LIKE', [{ found: 1 }]);

    expect(demo.hasSeeded(SEEDED_IDS)).toBe(true);
    expect(fake.callMatching('FROM sessions WHERE id LIKE').params).toEqual(['demo-%']);
  });

  it('is true while only the demo challenge remains (the circle retired its people)', () => {
    fake.whenSql('FROM challenges WHERE id = ?', [{ found: 1 }]);

    expect(demo.hasSeeded(SEEDED_IDS)).toBe(true);
  });
});

describe('removeSeeded', () => {
  it('runs in one transaction', () => {
    demo.removeSeeded(SEEDED_IDS, NOW);

    expect(fake.calls[0]?.sql).toBe('BEGIN');
    expect(fake.calls.at(-1)?.sql).toBe('COMMIT');
  });

  it('deletes only the seeded sessions, never a running one', () => {
    demo.removeSeeded(SEEDED_IDS, NOW);

    const call = fake.callMatching(/DELETE FROM sessions/);
    expect(call.sql).toContain("outcome != 'running'");
    expect(call.params).toEqual(['demo-%']);
  });

  it('takes the example habits with their marks, marks first, and unhooks a challenge of the user that counted one', () => {
    demo.removeSeeded(SEEDED_IDS, NOW);

    expect(fake.callMatching(/DELETE FROM habit_marks/).params).toEqual([...SEEDED_IDS.habits]);
    expect(fake.callMatching(/UPDATE challenges SET habit_id = NULL/).params).toEqual([
      ...SEEDED_IDS.habits,
      SEEDED_IDS.challenge,
    ]);
    expect(fake.callMatching(/DELETE FROM habits/).params).toEqual([...SEEDED_IDS.habits]);
    expect(indexOf(/DELETE FROM habit_marks/)).toBeLessThan(indexOf(/DELETE FROM habits/));
  });

  it('takes the example routines and modes, and turns off a routine of the user on an example mode', () => {
    demo.removeSeeded(SEEDED_IDS, NOW);

    expect(fake.callMatching(/DELETE FROM schedules/).params).toEqual([...SEEDED_IDS.schedules]);
    expect(fake.callMatching(/UPDATE schedules SET enabled = 0/).params).toEqual([NOW, ...SEEDED_IDS.modes]);
    expect(fake.callMatching(/DELETE FROM modes/).params).toEqual([...SEEDED_IDS.modes]);
    expect(indexOf(/DELETE FROM schedules/)).toBeLessThan(indexOf(/DELETE FROM modes/));
  });

  it('takes the demo circle, children before the people and the challenge', () => {
    demo.removeSeeded(SEEDED_IDS, NOW);

    const people = indexOf(/DELETE FROM circle_members/);
    for (const child of [/DELETE FROM challenge_marks/, /DELETE FROM kudos/, /DELETE FROM nudges/, /DELETE FROM member_weeks/]) {
      expect(indexOf(child)).toBeLessThan(people);
    }
    expect(fake.callMatching(/DELETE FROM circle_members/).params).toEqual([...SEEDED_IDS.members]);
    expect(fake.callMatching('DELETE FROM challenges WHERE id = ?').params).toEqual([SEEDED_IDS.challenge]);
  });

  it('rewrites a challenge of the user without the invented people, and leaves the others alone', () => {
    fake.whenSql('SELECT * FROM challenges', [
      {
        id: 'c-mine',
        name: 'Correr',
        weekly_target: 3,
        start_week_key: '2026-09-21',
        end_week_key: '2026-10-05',
        end_day_key: '2026-10-11',
        created_by: 'me',
        participant_ids: JSON.stringify(['me', 'ana', 'p-real']),
        habit_id: 'h-mine',
        created_at: NOW,
        archived_at: null,
      },
      {
        id: 'c-real',
        name: 'Leer',
        weekly_target: 4,
        start_week_key: '2026-09-21',
        end_week_key: '2026-10-05',
        end_day_key: null,
        created_by: 'p-real',
        participant_ids: JSON.stringify(['me', 'p-real']),
        habit_id: null,
        created_at: NOW,
        archived_at: null,
      },
    ]);

    demo.removeSeeded(SEEDED_IDS, NOW);

    const upserts = fake.calls.filter((call) => call.sql.includes('INSERT INTO challenges'));
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.params?.[0]).toBe('c-mine');
    expect(upserts[0]?.params).toContain(JSON.stringify(['me', 'p-real']));
  });

  it('keeps the grace days from the user’s first own session on', () => {
    const firstOwn = new Date(2026, 8, 20, 9).getTime();
    fake.whenSql('SELECT MIN(started_at)', [{ first: firstOwn }]);

    demo.removeSeeded(SEEDED_IDS, NOW);

    expect(fake.callMatching(/DELETE FROM grace_days/).params).toEqual(['2026-09-20']);
  });

  it('drops every grace day when the user has no session of their own', () => {
    fake.whenSql('SELECT MIN(started_at)', [{ first: null }]);

    demo.removeSeeded(SEEDED_IDS, NOW);

    const call = fake.callMatching(/DELETE FROM grace_days/);
    expect(call.sql).toBe('DELETE FROM grace_days');
  });

  it('moves the active mode to the first one left when it was an example', () => {
    fake.whenSql('SELECT value FROM settings', [{ value: 'mode-deep-work' }]);
    fake.whenSql('SELECT id FROM modes', [{ id: 'mode-mine' }]);

    demo.removeSeeded(SEEDED_IDS, NOW);

    const write = fake.callMatching(/INSERT INTO settings/);
    expect(write.params).toEqual(['active_mode_id', 'mode-mine', NOW]);
  });

  it('leaves no active mode when no mode is left', () => {
    fake.whenSql('SELECT value FROM settings', [{ value: 'mode-no-socials' }]);

    demo.removeSeeded(SEEDED_IDS, NOW);

    expect(fake.callMatching(/INSERT INTO settings/).params).toEqual(['active_mode_id', '', NOW]);
  });

  it('keeps an active mode of the user', () => {
    fake.whenSql('SELECT value FROM settings', [{ value: 'mode-mine' }]);

    demo.removeSeeded(SEEDED_IDS, NOW);

    expect(fake.calls.some((call) => call.sql.includes('INSERT INTO settings'))).toBe(false);
  });
});
