/**
 * Photos in challenges (ADR-0051, tanda 1): one optional photo pinned to one marked day
 * of one challenge, per person. On this phone only for now; the table is already shaped
 * for the shared tanda, where `member_id` is ME ('me') or a member id like every other
 * circle table.
 *
 * challenge_photos: UNIQUE(challenge_id, member_id, day_key) is the "one per person and
 * day" rule, and the index a challenge's photos are read by (its first column). A
 * replaced photo is a new row with a new id. `day_key` is the same local 'YYYY-MM-DD' as
 * habit_marks.day_key. `full_file` and `thumb_file` are file **names** inside the photos
 * directory, never paths: the app's container moves on iOS between installs and
 * restores. NULL while the file is not on this phone. Nothing here points at a mark: a
 * photo never changes, counts or verifies one, and a photo whose day is no longer marked
 * is kept and not drawn. No foreign keys, like the rest of the circle (004).
 *
 * challenges.photos: "Fotos del día", 1 or 0, chosen when the challenge is made. Every
 * challenge that already exists keeps offering photos; the two suggestions that clash
 * with a camera start off only from here on (data/challenges.ts).
 *
 * The rows stay out of the encrypted backup (src/db/backup.ts): the files are not in it.
 *
 * A shipped migration is never edited. Add 012_*.ts instead.
 */
export const CHALLENGE_PHOTOS_SQL = `
-- One photo per (challenge, person, day). origin is 'camera' or 'library'; caption is
-- one line of up to 80 characters or NULL; width and height are the full image's.
CREATE TABLE challenge_photos (
  id           TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  day_key      TEXT NOT NULL,
  origin       TEXT NOT NULL,
  caption      TEXT,
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  full_file    TEXT,
  thumb_file   TEXT,
  taken_at     INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE(challenge_id, member_id, day_key)
);

-- "Fotos del día". Existing challenges keep them on.
ALTER TABLE challenges ADD COLUMN photos INTEGER NOT NULL DEFAULT 1;
`;
