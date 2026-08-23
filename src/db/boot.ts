import { getDb } from './client';
import * as activities from './repositories/activities';
import * as sessions from './repositories/sessions';

export type BootResult = {
  activityCount: number;
  /** Sessions that survived a process death and were closed as `expired`. */
  orphansRecovered: number;
};

/**
 * Opens the database, applies migrations, seeds the default activities and closes any
 * orphaned session. Synchronous, because op-sqlite is — the app can call it before the
 * first render and know the database is usable when it returns.
 */
export function bootDatabase(now: number): BootResult {
  getDb();
  activities.seedDefaults(now);
  const orphansRecovered = sessions.recoverOrphans(now);

  return {
    activityCount: activities.listActive().length,
    orphansRecovered,
  };
}
