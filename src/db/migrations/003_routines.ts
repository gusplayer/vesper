/**
 * Routines gain a duration and may have no time at all: "cuando quieras" routines are
 * started by hand and run for duration_ms. A hand-started routine stores
 * start_minutes = -1 (the column is NOT NULL); the repository maps it to null.
 *
 * A shipped migration is never edited. Add 004_*.ts instead.
 */
export const ROUTINES_SQL = `
-- duration_ms: session length for a hand-started routine; also the cap of an
-- open-ended window (end_minutes NULL). NULL means the engine's defaults.
ALTER TABLE schedules ADD COLUMN duration_ms INTEGER;
`;
