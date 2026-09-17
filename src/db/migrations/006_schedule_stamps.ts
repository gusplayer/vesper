/**
 * A routine remembers when it was last saved or switched on, so a window that was
 * already open at that moment never starts a session the user did not ask for
 * (domain/routines.activeWindow). Existing rows read 0: before every window, so a
 * routine saved before this migration keeps every window it has today.
 *
 * A shipped migration is never edited. Add 007_*.ts instead.
 */
export const SCHEDULE_STAMPS_SQL = `
-- updated_at: last save or toggle. Windows that opened before it do not count.
ALTER TABLE schedules ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
`;
