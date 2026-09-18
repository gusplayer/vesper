import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STREAK_NUDGES_SQL } from '../migrations/007_streak_nudges';
import { createFakeDb, ddlColumns, insertColumns, type FakeRows } from '../testing/fakeDb';
import * as graceDays from './graceDays';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
}));

const T0 = 1_700_000_000_000;

beforeEach(() => {
  fake = createFakeDb();
});

describe('listGraceDays', () => {
  it('is empty when nothing was bridged', () => {
    expect(graceDays.listGraceDays()).toEqual([]);
  });

  it('maps the rows, oldest day first', () => {
    fake.whenSql('SELECT * FROM grace_days', [
      { day_key: '2026-08-03', month_key: '2026-08', created_at: T0 },
      { day_key: '2026-08-11', month_key: '2026-08', created_at: T0 + 1 },
    ]);

    expect(graceDays.listGraceDays()).toEqual([
      { dayKey: '2026-08-03', monthKey: '2026-08', createdAt: T0 },
      { dayKey: '2026-08-11', monthKey: '2026-08', createdAt: T0 + 1 },
    ]);
    expect(fake.callMatching('SELECT * FROM grace_days').sql).toContain('ORDER BY day_key');
  });
});

describe('insertGraceDay', () => {
  it('inserts in column order and ignores a day already bridged', () => {
    graceDays.insertGraceDay({ dayKey: '2026-08-03', monthKey: '2026-08', createdAt: T0 });

    const call = fake.callMatching(/INSERT OR IGNORE INTO grace_days/);
    expect(call.params).toEqual(['2026-08-03', '2026-08', T0]);
  });
});

describe('schema', () => {
  it('only inserts columns that exist in the grace_days table', () => {
    graceDays.insertGraceDay({ dayKey: '2026-08-03', monthKey: '2026-08', createdAt: T0 });

    const { table, columns } = insertColumns(fake.callMatching(/INSERT OR IGNORE INTO grace_days/).sql);
    expect(table).toBe('grace_days');
    expect(columns).toEqual(ddlColumns(STREAK_NUDGES_SQL, 'grace_days'));
  });
});
