/**
 * The phase 1 schema. This file is the migration itself.
 *
 * It is TypeScript and not .sql because Metro does not bundle .sql without extra
 * resolver configuration, and keeping both would mean two sources of truth for a
 * schema — worse than a template literal.
 *
 * A shipped migration is never edited. Add 002_*.ts instead.
 */
export const INIT_SQL = `
-- Phase 1 schema. Mirrors docs/DATA_MODEL.md.
--
-- Every date is epoch ms (INTEGER). The single exception is habit_marks.day_key,
-- justified in DATA_MODEL.md: weekly habit goals are counted in calendar days.
--
-- Every id is a UUID v7 so a future sync needs no key migration (ADR-0002).

CREATE TABLE activities (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0,
  archived_at  INTEGER,
  created_at   INTEGER NOT NULL
);

-- name is free text: sleep and steps are habits that are never focus sessions and
-- do not belong in the activity list. See ADR-0008.
CREATE TABLE habits (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  activity_id   TEXT REFERENCES activities(id),
  weekly_target INTEGER NOT NULL,
  count_mode    TEXT NOT NULL,
  health_type   TEXT,
  archived_at   INTEGER,
  created_at    INTEGER NOT NULL
);

-- block_profile exists from day one and stays NULL through phase 1, so enabling
-- blocking later needs no migration (ADR-0003).
--
-- outcome 'expired' means the process died mid-session and nobody closed the row.
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  activity_id   TEXT NOT NULL REFERENCES activities(id),
  planned_ms    INTEGER NOT NULL,
  actual_ms     INTEGER NOT NULL DEFAULT 0,
  outcome       TEXT NOT NULL,
  depth         TEXT NOT NULL,
  block_profile TEXT,
  intention     TEXT,
  exit_reason   TEXT,
  interruptions INTEGER NOT NULL DEFAULT 0,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER
);
CREATE INDEX idx_sessions_started ON sessions(started_at);

-- source_ref is NOT NULL DEFAULT '' on purpose: with it nullable the UNIQUE index
-- below would not stop duplicate manual marks, because SQLite treats NULLs as
-- distinct inside a UNIQUE index. See invariant 6 in DATA_MODEL.md.
CREATE TABLE habit_marks (
  id          TEXT PRIMARY KEY,
  habit_id    TEXT NOT NULL REFERENCES habits(id),
  day_key     TEXT NOT NULL,
  source      TEXT NOT NULL,
  source_ref  TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER,
  marked_at   INTEGER NOT NULL,
  UNIQUE(habit_id, day_key, source_ref)
);
CREATE INDEX idx_marks_day ON habit_marks(day_key);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
`;
