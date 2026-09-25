import type { SeededIds } from '../../data/seededIds';
import { dayKeyOf } from '../../domain/day';
import { getDb, transaction } from '../client';
import * as circle from './circle';
import * as settings from './settings';

/**
 * The demo data as a whole: whether any of it is left, and taking it away (ADR-0047 §1).
 * Only rows the seed wrote, by id (`src/data/seededIds.ts`); nothing the user made is
 * touched, except where it pointed at an example that is going away, and then it is
 * unhooked the way deleting that example by hand would unhook it.
 */

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}

/** True while any seeded row is still in the database: a session, mode, routine, habit or the demo circle. */
export function hasSeeded(ids: SeededIds): boolean {
  const db = getDb();
  const checks: readonly [string, string[]][] = [
    ['SELECT 1 AS found FROM sessions WHERE id LIKE ? LIMIT 1', [`${ids.sessionPrefix}%`]],
    [`SELECT 1 AS found FROM modes WHERE id IN (${placeholders(ids.modes)}) LIMIT 1`, [...ids.modes]],
    [`SELECT 1 AS found FROM schedules WHERE id IN (${placeholders(ids.schedules)}) LIMIT 1`, [...ids.schedules]],
    [`SELECT 1 AS found FROM habits WHERE id IN (${placeholders(ids.habits)}) LIMIT 1`, [...ids.habits]],
    [`SELECT 1 AS found FROM circle_members WHERE id IN (${placeholders(ids.members)}) LIMIT 1`, [...ids.members]],
    ['SELECT 1 AS found FROM challenges WHERE id = ? LIMIT 1', [ids.challenge]],
  ];
  return checks.some(([sql, params]) => db.executeSync(sql, params).rows.length > 0);
}

/**
 * Deletes every seeded row in one transaction, children before parents:
 *
 * - the seeded session history (never a running session, which no seed writes);
 * - the example habits with every mark of theirs; a challenge of the user's that
 *   counted one of them keeps going, unlinked;
 * - the example routines, then the example modes; a routine of the user's on an
 *   example mode is turned off, as deleting that mode by hand does;
 * - the demo circle: its four people with their weeks, kudos, nudges and marks, and
 *   the demo challenge; a challenge of the user's that listed one of them is rewritten
 *   without them;
 * - the grace days that could only have bridged the seeded history: those before the
 *   user's first own session, or all of them when there is none, so the month's grace
 *   is not spent on days that no longer exist;
 * - and, when the active mode was an example, the first mode left becomes active
 *   (none, when nothing is left).
 */
export function removeSeeded(ids: SeededIds, now: number): void {
  const db = getDb();
  transaction(() => {
    db.executeSync("DELETE FROM sessions WHERE id LIKE ? AND outcome != 'running'", [`${ids.sessionPrefix}%`]);

    db.executeSync(`DELETE FROM habit_marks WHERE habit_id IN (${placeholders(ids.habits)})`, [...ids.habits]);
    db.executeSync(`UPDATE challenges SET habit_id = NULL WHERE habit_id IN (${placeholders(ids.habits)}) AND id != ?`, [
      ...ids.habits,
      ids.challenge,
    ]);
    db.executeSync(`DELETE FROM habits WHERE id IN (${placeholders(ids.habits)})`, [...ids.habits]);

    db.executeSync(`DELETE FROM schedules WHERE id IN (${placeholders(ids.schedules)})`, [...ids.schedules]);
    db.executeSync(`UPDATE schedules SET enabled = 0, updated_at = ? WHERE mode_id IN (${placeholders(ids.modes)})`, [
      now,
      ...ids.modes,
    ]);
    db.executeSync(`DELETE FROM modes WHERE id IN (${placeholders(ids.modes)})`, [...ids.modes]);

    const members = placeholders(ids.members);
    db.executeSync(`DELETE FROM challenge_marks WHERE challenge_id = ? OR member_id IN (${members})`, [
      ids.challenge,
      ...ids.members,
    ]);
    db.executeSync(`DELETE FROM kudos WHERE from_id IN (${members}) OR to_id IN (${members})`, [
      ...ids.members,
      ...ids.members,
    ]);
    db.executeSync(`DELETE FROM nudges WHERE challenge_id = ? OR from_id IN (${members}) OR to_id IN (${members})`, [
      ids.challenge,
      ...ids.members,
      ...ids.members,
    ]);
    db.executeSync(`DELETE FROM member_weeks WHERE member_id IN (${members})`, [...ids.members]);
    db.executeSync(`DELETE FROM circle_members WHERE id IN (${members})`, [...ids.members]);
    db.executeSync('DELETE FROM challenges WHERE id = ?', [ids.challenge]);
    const seededPeople = new Set(ids.members);
    for (const challenge of circle.listChallenges()) {
      if (challenge.participantIds.some((id) => seededPeople.has(id))) {
        circle.upsertChallenge({
          ...challenge,
          participantIds: challenge.participantIds.filter((id) => !seededPeople.has(id)),
        });
      }
    }

    const first = db.executeSync('SELECT MIN(started_at) AS first FROM sessions').rows[0]?.first;
    if (typeof first === 'number') {
      db.executeSync('DELETE FROM grace_days WHERE day_key < ?', [dayKeyOf(first)]);
    } else {
      db.executeSync('DELETE FROM grace_days');
    }

    const active = settings.getActiveModeId();
    if (active !== null && ids.modes.includes(active)) {
      const next = db.executeSync('SELECT id FROM modes ORDER BY created_at, id LIMIT 1').rows[0]?.id;
      settings.setActiveModeId(typeof next === 'string' ? next : '', now);
    }
  });
}
