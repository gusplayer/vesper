/**
 * Photos shared with a challenge (ADR-0051, tanda 2): the same table, with what a photo
 * needs once it leaves the phone sealed, and once other people's arrive.
 *
 * challenge_photos:
 * - `content_key`: the photo's own AES-256 key, base64. Made here when the user's photo
 *   first goes up; opened from its wrap when someone else's arrives. NULL while it never
 *   left the phone, or when no wrap for this phone's key came with it. It is what the
 *   encrypted backup carries so a restore can open the photos again (src/db/backup.ts).
 * - `remote_state`: 'local' | 'queued' | 'posted' | 'uploaded' | 'remote'
 *   (`PhotoRemoteState` in domain/types.ts). Every photo of tanda 1 stays 'local': it was
 *   added under the promise that nothing leaves the phone.
 * - `expires_at`: when the server forgets it, as the server says. NULL while local.
 * - `caption_box`: the caption sealed with `content_key`, as it travels; the server never
 *   sees the caption itself.
 *
 * The queues that go with it (deletes and reports still to send, the people whose photos
 * the user hid, the circle's published keys) are small lists in the settings table, like
 * the circle's own queues (src/data/stores/photos.ts).
 *
 * A shipped migration is never edited. Add 013_*.ts instead.
 */
export const SHARED_PHOTOS_SQL = `
ALTER TABLE challenge_photos ADD COLUMN content_key TEXT;
ALTER TABLE challenge_photos ADD COLUMN remote_state TEXT NOT NULL DEFAULT 'local';
ALTER TABLE challenge_photos ADD COLUMN expires_at INTEGER;
ALTER TABLE challenge_photos ADD COLUMN caption_box TEXT;
`;
