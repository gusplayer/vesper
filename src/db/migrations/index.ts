import { INIT_SQL } from './001_init';

export type Migration = {
  /** Monotonic. Recorded in _migrations so it is applied exactly once. */
  id: number;
  name: string;
  sql: string;
};

/** Applied in ascending id order. Append only. */
export const migrations: Migration[] = [{ id: 1, name: 'init', sql: INIT_SQL }];
