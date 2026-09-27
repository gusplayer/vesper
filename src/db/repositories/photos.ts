import type { DayKey, PhotoOrigin, PhotoRemoteState, PhotoShare, StoredPhoto } from '../../domain/types';
import { getDb, rowsAs, transaction } from '../client';

/**
 * The photos pinned to challenge days (ADR-0051, migrations 011 and 012). Rows only: the
 * files live in the photos directory behind `src/platform/camera.ts`, and deleting them
 * is the store's half of every delete here (`src/data/stores/photos.ts`). A row holds
 * file names, never paths.
 *
 * Since tanda 2 a row also says where the photo stands with the server (`PhotoShare`):
 * its key, its state, when the server forgets it and its sealed caption.
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
  content_key?: string | null;
  remote_state?: string | null;
  expires_at?: number | null;
  caption_box?: string | null;
};

const REMOTE_STATES: readonly PhotoRemoteState[] = ['local', 'queued', 'posted', 'uploaded', 'remote'];

/** Anything unknown reads as 'local': a photo is never sent because a column said something odd. */
function remoteStateOf(value: string | null | undefined): PhotoRemoteState {
  return REMOTE_STATES.find((state) => state === value) ?? 'local';
}

/** An empty text is none, like NULL. */
function textOf(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value;
}

/** Anything but 'camera' reads as the library: the viewer never claims more than it knows. */
function originOf(value: string): PhotoOrigin {
  return value === 'camera' ? 'camera' : 'library';
}

/** An empty name is no file, like NULL. */
function fileOf(value: string | null): string | null {
  return value === null || value === '' ? null : value;
}

function toPhoto(row: PhotoRow): StoredPhoto {
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
    contentKey: textOf(row.content_key),
    remoteState: remoteStateOf(row.remote_state),
    expiresAt: typeof row.expires_at === 'number' && Number.isFinite(row.expires_at) ? row.expires_at : null,
    captionBox: textOf(row.caption_box),
  };
}

/** Every photo on this phone, by challenge and day. */
export function listPhotos(): StoredPhoto[] {
  return rowsAs<PhotoRow>(
    getDb().executeSync('SELECT * FROM challenge_photos ORDER BY challenge_id, day_key, member_id'),
  ).map(toPhoto);
}

/** The photos of one challenge, by day. */
export function listChallengePhotos(challengeId: string): StoredPhoto[] {
  return rowsAs<PhotoRow>(
    getDb().executeSync('SELECT * FROM challenge_photos WHERE challenge_id = ? ORDER BY day_key, member_id', [
      challengeId,
    ]),
  ).map(toPhoto);
}

/** Every photo of one person, in any challenge. */
export function listMemberPhotos(memberId: string): StoredPhoto[] {
  return rowsAs<PhotoRow>(
    getDb().executeSync('SELECT * FROM challenge_photos WHERE member_id = ? ORDER BY challenge_id, day_key', [
      memberId,
    ]),
  ).map(toPhoto);
}

export function findPhoto(id: string): StoredPhoto | null {
  const [row] = rowsAs<PhotoRow>(getDb().executeSync('SELECT * FROM challenge_photos WHERE id = ? LIMIT 1', [id]));
  return row === undefined ? null : toPhoto(row);
}

/** The photo of one person on one day of one challenge, or null. */
export function findPhotoAt(challengeId: string, memberId: string, dayKey: DayKey): StoredPhoto | null {
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
export function replacePhoto(photo: StoredPhoto): void {
  transaction(() => {
    writePhoto(photo);
  });
}

/** The two statements of `replacePhoto`, for a caller that already opened the transaction. */
function writePhoto(photo: StoredPhoto): void {
  const db = getDb();
  db.executeSync(
    'DELETE FROM challenge_photos WHERE id = ? OR (challenge_id = ? AND member_id = ? AND day_key = ?)',
    [photo.id, photo.challengeId, photo.memberId, photo.dayKey],
  );
  db.executeSync(
    `INSERT INTO challenge_photos
       (id, challenge_id, member_id, day_key, origin, caption, width, height, full_file, thumb_file, taken_at, created_at, updated_at,
        content_key, remote_state, expires_at, caption_box)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      photo.contentKey,
      photo.remoteState,
      photo.expiresAt,
      photo.captionBox,
    ],
  );
}

/**
 * Where a photo stands with the server, changed in place: the fields given, and
 * `updated_at`. Nothing else of the row moves, so the queue can record each step of an
 * upload without rewriting the photo.
 */
export function updateShare(id: string, patch: Partial<PhotoShare>, now: number): void {
  const columns: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.contentKey !== undefined) {
    columns.push('content_key = ?');
    values.push(patch.contentKey);
  }
  if (patch.remoteState !== undefined) {
    columns.push('remote_state = ?');
    values.push(patch.remoteState);
  }
  if (patch.expiresAt !== undefined) {
    columns.push('expires_at = ?');
    values.push(patch.expiresAt);
  }
  if (patch.captionBox !== undefined) {
    columns.push('caption_box = ?');
    values.push(patch.captionBox);
  }
  if (columns.length === 0) {
    return;
  }
  getDb().executeSync(`UPDATE challenge_photos SET ${columns.join(', ')}, updated_at = ? WHERE id = ?`, [
    ...values,
    now,
    id,
  ]);
}

/** A file of a photo written to the photos directory: its name, recorded on the row. */
export function setPhotoFile(id: string, variant: 'full' | 'thumb', name: string | null): void {
  const column = variant === 'full' ? 'full_file' : 'thumb_file';
  getDb().executeSync(`UPDATE challenge_photos SET ${column} = ? WHERE id = ?`, [name, id]);
}

/** Several photos at once (a sync's worth), in one transaction. */
export function deletePhotos(ids: readonly string[]): void {
  if (ids.length === 0) {
    return;
  }
  transaction(() => {
    for (const id of ids) {
      getDb().executeSync('DELETE FROM challenge_photos WHERE id = ?', [id]);
    }
  });
}

/** Several photos written as `replacePhoto` writes one, in one transaction. */
export function replacePhotos(photos: readonly StoredPhoto[]): void {
  if (photos.length === 0) {
    return;
  }
  transaction(() => {
    for (const photo of photos) {
      writePhoto(photo);
    }
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
