import { INIT_SQL } from './001_init';
import { MODES_SQL } from './002_modes_schedules';
import { ROUTINES_SQL } from './003_routines';
import { CIRCLE_SQL } from './004_circle';
import { OPEN_SESSIONS_BREAKS_SQL } from './005_open_sessions_breaks';
import { SCHEDULE_STAMPS_SQL } from './006_schedule_stamps';
import { STREAK_NUDGES_SQL } from './007_streak_nudges';
import { KEYS_SQL } from './008_keys';
import { KEY_ROLE_AND_STEP_SQL } from './009_key_role_and_step';
import { DICTATED_CODE_SQL } from './010_dictated_code';
import { UNSHARED_METRICS_SQL } from './011_unshared_metrics';

export type Migration = {
  /** Monotonic. Recorded in _migrations so it is applied exactly once. */
  id: number;
  name: string;
  sql: string;
};

/** Applied in ascending id order. Append only. */
export const migrations: Migration[] = [
  { id: 1, name: 'init', sql: INIT_SQL },
  { id: 2, name: 'modes_schedules', sql: MODES_SQL },
  { id: 3, name: 'routines', sql: ROUTINES_SQL },
  { id: 4, name: 'circle', sql: CIRCLE_SQL },
  { id: 5, name: 'open_sessions_breaks', sql: OPEN_SESSIONS_BREAKS_SQL },
  { id: 6, name: 'schedule_stamps', sql: SCHEDULE_STAMPS_SQL },
  { id: 7, name: 'streak_nudges', sql: STREAK_NUDGES_SQL },
  { id: 8, name: 'keys', sql: KEYS_SQL },
  { id: 9, name: 'key_role_and_step', sql: KEY_ROLE_AND_STEP_SQL },
  { id: 10, name: 'dictated_code', sql: DICTATED_CODE_SQL },
  { id: 11, name: 'unshared_metrics', sql: UNSHARED_METRICS_SQL },
];
