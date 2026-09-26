import type { ChallengePhoto, DayKey, PhotoOrigin } from '../../domain/types';
import { getDb, rowsAs, transaction } from '../client';

/**
 * The photos pinned to challenge days (ADR-0051, migration 011). Rows only: the files
 * live in the photos directory behind `src/platform/camera.ts`, and deleting them is the
 * store's half of every delete here (`src/data/stores/photos.ts`). A row holds file
 * names, never paths.
 *
 * Every list reads the whole table: one photo per person and day, at most twelve people,
 * and a challenge's photos go when it is archived.
 */

type PhotoRow = {
  id: string;
  challenge_id: string;
  member_id: string;
  day_key: string;
  origin: string;
  caption: string | null;
  width: number;
  height: number;
  full_file: string | null;
  thumb_file: string | null;
  taken_at: number;
  created_at: number;
  updated_at: number;
};

/** Anything but 'camera' reads as the library: the viewer never claims more than it knows. */
function originOf(value: string): PhotoOrigin {
  return value === 'camera' ? 'camera' : 'library';
}

/** An empty name is no file, like NULL. */
function fileOf(value: string | null): string | null {
  return value === null || value === '' ? null : value;
}

function toPhoto(row: PhotoRow): ChallengePhoto {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    memberId: row.member_id,
    dayKey: row.day_key,
    origin: originOf(row.origin),
    caption: row.caption === null || row.caption === '' ? null : row.caption,
    width: row.width,
    height: row.height,
    fullFile: fileOf(row.full_file),
    thumbFile: fileOf(row.thumb_file),
    takenAt: row.taken_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every photo on this phone, by challenge and day. */
export function listPhotos(): ChallengePhoto[] {
  return rowsAs<PhotoRow>(
    getDb().executeSync('SELECT * FROM challenge_photos ORDER BY challenge_id, day_key, member_id'),
  ).map(toPhoto);
}

/** The photos of one challenge, by day. */
export function listChallengePhotos(challengeId: string): ChallengePhoto[] {
  return rowsAs<PhotoRow>(
    getDb().executeSync('SELECT * FROM challenge_photos WHERE challenge_id = ? ORDER BY day_key, member_id', [
      challengeId,
    ]),
  ).map(toPhoto);
}

/** Every photo of one person, in any challenge. */
export function listMemberPhotos(memberId: string): ChallengePhoto[] {
  return rowsAs<PhotoRow>(
    getDb().executeSync('SELECT * FROM challenge_photos WHERE member_id = ? ORDER BY challenge_id, day_key', [
      memberId,
    ]),
  ).map(toPhoto);
}

export function findPhoto(id: string): ChallengePhoto | null {
  const [row] = rowsAs<PhotoRow>(getDb().executeSync('SELECT * FROM challenge_photos WHERE id = ? LIMIT 1', [id]));
  return row === undefined ? null : toPhoto(row);
}

/** The photo of one person on one day of one challenge, or null. */
export function findPhotoAt(challengeId: string, memberId: string, dayKey: DayKey): ChallengePhoto | null {
  const [row] = rowsAs<PhotoRow>(
    getDb().executeSync(
      'SELECT * FROM challenge_photos WHERE challenge_id = ? AND member_id = ? AND day_key = ? LIMIT 1',
      [challengeId, memberId, dayKey],
    ),
  );
  return row === undefined ? null : toPhoto(row);
}

/**
 * Writes a photo as the only one of its (challenge, person, day), in one transaction:
 * whatever held that day, or that id, goes, and this row takes its place. A replaced
 * photo is a new photo — new id, new files — so nothing of the old row is kept; its
 * files are the caller's to delete.
 */
export function replacePhoto(photo: ChallengePhoto): void {
  transaction(() => {
    const db = getDb();
    db.executeSync(
      'DELETE FROM challenge_photos WHERE id = ? OR (challenge_id = ? AND member_id = ? AND day_key = ?)',
      [photo.id, photo.challengeId, photo.memberId, photo.dayKey],
    );
    db.executeSync(
      `INSERT INTO challenge_photos
         (id, challenge_id, member_id, day_key, origin, caption, width, height, full_file, thumb_file, taken_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        photo.id,
        photo.challengeId,
        photo.memberId,
        photo.dayKey,
        photo.origin,
        photo.caption,
        photo.width,
        photo.height,
        photo.fullFile,
        photo.thumbFile,
        photo.takenAt,
        photo.createdAt,
        photo.updatedAt,
      ],
    );
  });
}

export function deletePhoto(id: string): void {
  getDb().executeSync('DELETE FROM challenge_photos WHERE id = ?', [id]);
}

/** Archiving a challenge. */
export function deleteChallengePhotos(challengeId: string): void {
  getDb().executeSync('DELETE FROM challenge_photos WHERE challenge_id = ?', [challengeId]);
}

/** A person out of the circle goes with their photos, like with their marks. */
export function deleteMemberPhotos(memberId: string): void {
  getDb().executeSync('DELETE FROM challenge_photos WHERE member_id = ?', [memberId]);
}

/** "Borrar todo y reiniciar". */
export function deleteAllPhotos(): void {
  getDb().executeSync('DELETE FROM challenge_photos');
}
