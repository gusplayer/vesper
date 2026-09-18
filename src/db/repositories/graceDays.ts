import type { GraceDay } from '../../domain/types';
import { getDb, rowsAs } from '../client';

/**
 * The days the streak was bridged on its own (ADR-0027). One row per day, keyed by
 * the day, so applying grace twice to the same day is a no-op: the store re-reads
 * after writing instead of trusting its cache.
 */

type GraceDayRow = {
  day_key: string;
  month_key: string;
  created_at: number;
};

function toGraceDay(row: GraceDayRow): GraceDay {
  return { dayKey: row.day_key, monthKey: row.month_key, createdAt: row.created_at };
}

export function listGraceDays(): GraceDay[] {
  return rowsAs<GraceDayRow>(getDb().executeSync('SELECT * FROM grace_days ORDER BY day_key')).map(
    toGraceDay,
  );
}

export function insertGraceDay(day: GraceDay): void {
  getDb().executeSync(
    'INSERT OR IGNORE INTO grace_days (day_key, month_key, created_at) VALUES (?, ?, ?)',
    [day.dayKey, day.monthKey, day.createdAt],
  );
}
