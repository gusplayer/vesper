/**
 * Open sessions and breaks (ADR-0022). An open session ("sin límite") keeps
 * planned_ms as its cap; the flag only changes how it ends and what it shows. A break
 * is two columns on the session, not a table: one runs at a time and only the total
 * matters afterwards.
 *
 * A shipped migration is never edited. Add 006_*.ts instead.
 */
export const OPEN_SESSIONS_BREAKS_SQL = `
-- open: 1 for "sin límite". planned_ms then holds the cap (12 h), not a choice.
ALTER TABLE sessions ADD COLUMN open INTEGER NOT NULL DEFAULT 0;
-- break_ms: time in finished breaks. Never focus. The clock skips it.
ALTER TABLE sessions ADD COLUMN break_ms INTEGER NOT NULL DEFAULT 0;
-- break_started_at: the break running right now, NULL otherwise.
ALTER TABLE sessions ADD COLUMN break_started_at INTEGER;
-- next_break_at_ms: focus time at which the next break unlocks (25 min at first).
ALTER TABLE sessions ADD COLUMN next_break_at_ms INTEGER NOT NULL DEFAULT 1500000;
`;
