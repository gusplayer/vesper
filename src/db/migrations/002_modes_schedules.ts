/**
 * Modes and schedules, the two things the Brick-shaped prototype (ADR-0016) invented
 * that phase 1 had no table for. Everything else the prototype holds — sessions,
 * habits, marks, settings — already had one in 001 (ADR-0017).
 *
 * A shipped migration is never edited. Add 003_*.ts instead.
 */
export const MODES_SQL = `
-- Modes and schedules. Mirrors docs/DATA_MODEL.md.
--
-- app_ids and website_ids are JSON arrays of strings. They are the prototype's
-- catalogue ids, never real bundle ids: iOS never gives those (ADR-0004). The real
-- selection lives in selection_token, opaque, and is never resolved to names.
--
-- activity_id holds the activity key ('trabajo'), not the activities row id, because
-- the prototype's mode editor works in keys. It is resolved to a row id when a session
-- starts, which is where the foreign key lives.
CREATE TABLE modes (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  behavior        TEXT NOT NULL,
  app_ids         TEXT NOT NULL DEFAULT '[]',
  website_ids     TEXT NOT NULL DEFAULT '[]',
  depth           TEXT NOT NULL,
  activity_id     TEXT NOT NULL,
  selection_token TEXT,
  created_at      INTEGER NOT NULL
);

-- days is a JSON array of seven booleans, Monday first. end_minutes NULL means
-- "until you end it".
--
-- mode_id is deliberately not a foreign key: deleting a mode turns its schedules off
-- instead of deleting them, like Brick warns, and a RESTRICT constraint would refuse
-- the delete.
CREATE TABLE schedules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  mode_id       TEXT NOT NULL,
  start_minutes INTEGER NOT NULL,
  end_minutes   INTEGER,
  days          TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_schedules_mode ON schedules(mode_id);
`;
