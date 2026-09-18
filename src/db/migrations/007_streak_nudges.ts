/**
 * ADR-0027: the daily streak's grace days, the circle's nudges, and challenges that
 * end on a day rather than on a week (21 days, or never).
 *
 * grace_days: one row per day the streak was bridged automatically. `month_key` is
 * 'YYYY-MM' of that day, so the three-a-month budget is one COUNT.
 * nudges: one person pushing another on a challenge they share, once a day at most.
 * Either side can be ME ('me'). No foreign keys, like the rest of the circle (004).
 * challenges.end_day_key: the last day of the challenge, inclusive, or NULL for a
 * challenge with no end. Existing rows end on the Sunday of their last week, which
 * is what they meant. `end_week_key` stays for the schema's sake and is derived on
 * write; nothing reads it any more.
 *
 * A shipped migration is never edited. Add 008_*.ts instead.
 */
export const STREAK_NUDGES_SQL = `
CREATE TABLE grace_days (
  day_key     TEXT PRIMARY KEY,
  month_key   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX grace_days_month ON grace_days(month_key);

CREATE TABLE nudges (
  id            TEXT PRIMARY KEY,
  from_id       TEXT NOT NULL,
  to_id         TEXT NOT NULL,
  challenge_id  TEXT NOT NULL,
  day_key       TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX nudges_to_day ON nudges(to_id, day_key);

ALTER TABLE challenges ADD COLUMN end_day_key TEXT;
UPDATE challenges SET end_day_key = date(end_week_key, '+6 days');
`;
