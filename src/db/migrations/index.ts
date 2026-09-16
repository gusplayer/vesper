import { INIT_SQL } from './001_init';
import { MODES_SQL } from './002_modes_schedules';
import { ROUTINES_SQL } from './003_routines';
import { CIRCLE_SQL } from './004_circle';

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
];
