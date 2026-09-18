import {
  demoChallenge,
  demoChallengeMarks,
  demoKudos,
  demoMembers,
  demoMemberWeeks,
  demoNudges,
} from '../data/circleSeed';
import { demoActivities, demoHabits, demoModes, demoSchedules, seedDemoSessions, seedHabitMarks } from '../data/seed';
import type { Strings } from '../i18n/es';
import { getDb, transaction } from './client';
import * as activities from './repositories/activities';
import * as circle from './repositories/circle';
import * as habits from './repositories/habits';
import * as modes from './repositories/modes';
import * as schedules from './repositories/schedules';
import * as sessions from './repositories/sessions';
import * as settings from './repositories/settings';

/** The words the demo data is written with. The caller resolves the language (ADR-0020). */
type DemoStrings = Strings['demo'];

export type BootResult = {
  activityCount: number;
  /**
   * Sessions that survived a process death past their end and were closed at that
   * end: `completed` for a chosen duration, `expired` for an open session at its cap.
   */
  orphansRecovered: number;
  /** True when this boot wrote the demo data, i.e. the database was empty. */
  demoSeeded: boolean;
};

/**
 * The activities row id for an activity key ('trabajo'), or for a row id passed
 * through unchanged. The prototype's modes and habit editor speak in keys; the
 * sessions and habits tables carry a foreign key to the row. Falls back to the first
 * activity rather than failing: a session must never be refused over a label.
 */
export function resolveActivityId(keyOrId: string): string {
  return (
    activities.findByKey(keyOrId)?.id ??
    activities.findById(keyOrId)?.id ??
    activities.listActive()[0]?.id ??
    keyOrId
  );
}

/**
 * Writes the demo data once. Guarded by a settings key rather than by "is the table
 * empty", so a user who deletes every mode does not get the demo ones back at the
 * next launch (ADR-0017). The names are written in `demo`'s language and stay that
 * way: they are the user's rows from here on (ADR-0020).
 */
function seedDemoData(now: number, demo: DemoStrings): boolean {
  if (settings.get(settings.SETTING_KEYS.demoSeededAt) !== null) {
    return false;
  }

  const seededModes = demoModes(demo);
  transaction(() => {
    for (const mode of seededModes) {
      modes.upsert(mode);
    }
    for (const schedule of demoSchedules(demo)) {
      schedules.upsert(schedule, now);
    }
    for (const habit of demoHabits(demo)) {
      habits.upsert({
        ...habit,
        activityId: habit.activityId === null ? null : resolveActivityId(habit.activityId),
      });
    }
    for (const mark of seedHabitMarks(now)) {
      habits.mark(mark, now);
    }
    for (const session of seedDemoSessions(now)) {
      sessions.insert({ ...session, activityId: resolveActivityId(session.activityId) });
    }
    // The circle (ADR-0021): people, weeks, kudos, a challenge and a nudge. Never the profile.
    for (const member of demoMembers(now)) {
      circle.upsertMember(member);
    }
    for (const week of demoMemberWeeks(now)) {
      circle.upsertMemberWeek(week);
    }
    for (const kudos of demoKudos(now)) {
      circle.insertKudos(kudos);
    }
    circle.upsertChallenge(demoChallenge(now, demo));
    for (const mark of demoChallengeMarks(now)) {
      circle.upsertChallengeMark(mark);
    }
    for (const nudge of demoNudges(now)) {
      circle.insertNudge(nudge);
    }
    const firstMode = seededModes[0];
    if (firstMode !== undefined) {
      settings.setActiveModeId(firstMode.id, now);
    }
    settings.setNumber(settings.SETTING_KEYS.demoSeededAt, now, now);
  });

  return true;
}

/**
 * Opens the database, applies migrations, seeds the default activities, closes any
 * orphaned session and, on a fresh database, writes the demo data in the language of
 * `demo`. Synchronous, because op-sqlite is — the app can call it before the first
 * render and know the database is usable when it returns.
 */
export function bootDatabase(now: number, demo: DemoStrings): BootResult {
  getDb();
  activities.seedDefaults(now, demoActivities(demo));
  const orphansRecovered = sessions.recoverOrphans(now);
  const demoSeeded = seedDemoData(now, demo);

  return {
    activityCount: activities.listActive().length,
    orphansRecovered,
    demoSeeded,
  };
}

/** Children before parents, so the foreign keys let every DELETE through. */
const TABLES_IN_DELETE_ORDER = [
  'nudges',
  'grace_days',
  'challenge_marks',
  'challenges',
  'kudos',
  'member_weeks',
  'circle_members',
  'habit_marks',
  'sessions',
  'habits',
  'schedules',
  'modes',
  'settings',
  'activities',
] as const;

/**
 * "Borrar todo y reiniciar": empties every table (the schema stays) and puts the
 * database back the way a first launch finds it, demo data included. The caller
 * rehydrates the stores afterwards; this function knows nothing about them.
 */
export function resetDatabase(now: number, demo: DemoStrings): BootResult {
  const db = getDb();
  transaction(() => {
    for (const table of TABLES_IN_DELETE_ORDER) {
      db.executeSync(`DELETE FROM ${table}`);
    }
  });
  return bootDatabase(now, demo);
}
