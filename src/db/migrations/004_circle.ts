/**
 * The circle (ADR-0021): the people the user chose, their weeks as a server would
 * deliver them, kudos, and challenges with their witnesses' marks. The user's own
 * profile and share preferences are JSON keys in settings, not tables: one row each.
 *
 * No foreign keys on purpose. ME ('me') is a participant and a kudos side without
 * being a circle_members row, member rows will one day come from the network and be
 * replaced wholesale, and a habit archived by the user must never refuse the delete.
 * Who removes what is decided in the repository and the store.
 *
 * A shipped migration is never edited. Add 005_*.ts instead.
 */
export const CIRCLE_SQL = `
-- The circle. Mirrors docs/DATA_MODEL.md.
--
-- status is 'member' (in the circle), 'invited' (the user invited them, no answer
-- yet) or 'pending' (they invited the user). joined_at is NULL until accepted.
CREATE TABLE circle_members (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  handle     TEXT NOT NULL,
  status     TEXT NOT NULL,
  joined_at  INTEGER,
  created_at INTEGER NOT NULL
);

-- One row per member and week, what a server would deliver. week_key is the DayKey
-- of that week's Monday, the same local 'YYYY-MM-DD' as habit_marks.day_key.
-- social_ms NULL means the member does not share it; it is a floor, never summed.
CREATE TABLE member_weeks (
  member_id     TEXT NOT NULL,
  week_key      TEXT NOT NULL,
  focus_ms      INTEGER NOT NULL DEFAULT 0,
  social_ms     INTEGER,
  habits_done   INTEGER NOT NULL DEFAULT 0,
  habits_target INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (member_id, week_key)
);

-- One person cheering another, once a day: the UNIQUE index is the rule, and
-- INSERT OR IGNORE keeps a double tap from becoming two rows. Either side can be 'me'.
CREATE TABLE kudos (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  day_key    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(from_id, to_id, day_key)
);
CREATE INDEX idx_kudos_day ON kudos(day_key);

-- A habit with witnesses. participant_ids is a JSON array of 'me' and member ids.
-- start_week_key and end_week_key are Monday DayKeys, both inclusive. habit_id is
-- the user's habit that counts, NULL while the user has not joined.
CREATE TABLE challenges (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  weekly_target   INTEGER NOT NULL,
  start_week_key  TEXT NOT NULL,
  end_week_key    TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  participant_ids TEXT NOT NULL DEFAULT '[]',
  habit_id        TEXT,
  created_at      INTEGER NOT NULL,
  archived_at     INTEGER
);

-- Other participants' marks. Never 'me': the user's marks are habit_marks.
CREATE TABLE challenge_marks (
  id           TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  day_key      TEXT NOT NULL,
  marked_at    INTEGER NOT NULL,
  UNIQUE(challenge_id, member_id, day_key)
);
CREATE INDEX idx_challenge_marks_challenge ON challenge_marks(challenge_id);
`;
