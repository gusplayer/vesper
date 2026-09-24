/**
 * A week metric nobody shares is NULL, never zero (ADR-0021 §4, ADR-0033, ADR-0035).
 *
 * Migration 004 declared `focus_ms`, `habits_done` and `habits_target` as
 * `NOT NULL DEFAULT 0`, back when the only writer was the demo seed and every number
 * existed. The server of ADR-0033 sends null for a metric its owner keeps to
 * themselves, and null landing in a NOT NULL column becomes 0: "no hice nada esta
 * semana", which is a different and false thing to say about someone who simply did
 * not publish the number. `social_ms` was nullable from the start and is the shape
 * the other three take here.
 *
 * SQLite cannot drop a NOT NULL with ALTER, and a rebuild would need INSERT ... SELECT
 * and DROP TABLE, which `src/db/sql.test.ts` forbids on purpose: a migration in this
 * project is only CREATE, ALTER TABLE and a backfilling UPDATE. So this follows the
 * pattern 007 already used for `challenges.end_day_key`: a nullable column beside the
 * legacy one, backfilled once, and from here on the nullable column is the truth.
 * `focus_ms`, `habits_done` and `habits_target` stay for the schema's sake, written on
 * every upsert as `value ?? 0` so an old reader never sees a stale number, and read by
 * nothing (see `src/db/repositories/circle.ts`).
 *
 * The backfill copies what is there, which is the honest thing for a seeded row: every
 * demo member shares everything. A row a sync had already flattened to 0 before this
 * migration stays 0 — that value is unrecoverable here — and corrects itself the next
 * time its owner's week changes and the server sends it again.
 *
 * A shipped migration is never edited. Add 011_*.ts instead.
 */
export const MEMBER_WEEKS_NOT_SHARED_SQL = `
-- NULL is "this person does not share it". A number, zero included, is a number.
ALTER TABLE member_weeks ADD COLUMN focus_ms_shared INTEGER;
ALTER TABLE member_weeks ADD COLUMN habits_done_shared INTEGER;
ALTER TABLE member_weeks ADD COLUMN habits_target_shared INTEGER;
UPDATE member_weeks SET focus_ms_shared = focus_ms, habits_done_shared = habits_done, habits_target_shared = habits_target;
`;
