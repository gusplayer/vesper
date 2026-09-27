/**
 * The shield asks and counts (ADR-0053).
 *
 * usage_events: what happened on the shield, one row per event, as ADR-0004 and
 * docs/DATA_MODEL.md drew it long before anything wrote to it. Only the kinds the
 * shield produces exist today ('shield_hit' on Android, 'backed_off' and
 * 'unlock_granted' on both). Never a row from DeviceActivityReport (rule 10).
 * - `token`: the package on Android, the encoded ApplicationToken on iOS. Never a name.
 * - `duration_ms`: the break length chosen, on 'unlock_granted' only.
 * - `session_id`: the session running at `fired_at`; NULL if none was.
 *
 * breaks: every break, one row, from either door: the session's own button
 * (`source` 'session', no token) or the shield over an app ('shield', with its token).
 * `sessions.break_ms` keeps the total the clock needs; this is the count and the per-app
 * line. `ended_at` stays NULL while the break runs.
 *
 * sessions.break_length_ms: how long the current break was chosen to last. The shield
 * offers 5, 10 or 15 min; everything before this migration was 15.
 *
 * A shipped migration is never edited. Add 014_*.ts instead.
 */
export const SHIELD_EVENTS_BREAKS_SQL = `
CREATE TABLE usage_events (
  id          TEXT PRIMARY KEY,
  platform    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  token       TEXT NOT NULL,
  duration_ms INTEGER,
  session_id  TEXT REFERENCES sessions(id),
  fired_at    INTEGER NOT NULL
);
CREATE INDEX idx_usage_fired ON usage_events(fired_at);
CREATE INDEX idx_usage_session ON usage_events(session_id);

CREATE TABLE breaks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  length_ms   INTEGER NOT NULL,
  source      TEXT NOT NULL,
  token       TEXT
);
CREATE INDEX idx_breaks_started ON breaks(started_at);
CREATE INDEX idx_breaks_session ON breaks(session_id);

ALTER TABLE sessions ADD COLUMN break_length_ms INTEGER NOT NULL DEFAULT 900000;
`;
