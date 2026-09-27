import { cleanCaption } from './photos';
import {
  ME,
  type Challenge,
  type DayKey,
  type Member,
  type Millis,
  type PhotoOrigin,
  type StoredPhoto,
} from './types';

/**
 * Photos shared with a challenge (ADR-0051, tanda 2), the rules and nothing else: who a
 * photo is for, which photos are drawn, and how what the server sends lands on the rows
 * this phone keeps. Pure; the crypto, the wire and the files are src/platform/photoSync.
 *
 * A photo leaves the phone sealed with a key of its own, wrapped for each participant
 * who had published a key when it went up. The server keeps bytes it cannot open, for
 * 14 days after the challenge closes (28 per photo in one with no end), and nobody is
 * told anything: they arrive with the sync (ADR-0051 §8).
 */

/**
 * Who sees a photo of the user's in a challenge, besides the user: the other
 * participants who are in the circle and have published a key (`keyHolders`, account
 * ids). Nobody when the challenge has no photos or there is no circle account
 * (`sharing` false): then the photo stays on this phone, and the preview says "Solo la
 * ves tú". Someone who joins later is not in it, so they never see what came before
 * (ADR-0051 §5). In the challenge's order.
 */
export function photoAudience(input: {
  challenge: Pick<Challenge, 'photos' | 'participantIds' | 'archivedAt'>;
  members: readonly Member[];
  keyHolders: ReadonlySet<string>;
  sharing: boolean;
}): Member[] {
  const { challenge, members, keyHolders, sharing } = input;
  if (!sharing || !challenge.photos || challenge.archivedAt !== null) {
    return [];
  }
  const audience: Member[] = [];
  for (const id of challenge.participantIds) {
    if (id === ME || !keyHolders.has(id)) {
      continue;
    }
    const member = members.find((candidate) => candidate.id === id && candidate.status === 'member');
    if (member !== undefined) {
      audience.push(member);
    }
  }
  return audience;
}

/**
 * What decides whether a photo is drawn: the people hidden by the user, and the time.
 * `now` null leaves the time out: the store deletes expired photos by itself at every
 * launch and every sync (`expiredPhotos`), so a screen without a clock of its own can
 * still ask.
 */
export type PhotoVisibility = { hidden: ReadonlySet<string>; now: Millis | null };

/**
 * Whether a photo is drawn. The user's own always are, shared or not, until the
 * challenge is archived (ADR-0051 §13). Somebody else's is drawn only when:
 *
 * - its person is not hidden ("Ocultar las fotos de Ana", only for the user; nothing is
 *   deleted, it is just not drawn),
 * - this phone could open its key (a photo with no wrap for this key cannot be opened:
 *   its person added it before the user joined, or before the user's key was published),
 * - and the server still keeps it: past `expiresAt` it is gone for everyone, and each
 *   phone lets it go on its own, without waiting for a tombstone.
 */
export function photoVisible(photo: StoredPhoto, visibility: PhotoVisibility): boolean {
  if (photo.memberId === ME) {
    return true;
  }
  if (visibility.hidden.has(photo.memberId)) {
    return false;
  }
  if (photo.contentKey === null) {
    return false;
  }
  return photo.expiresAt === null || visibility.now === null || photo.expiresAt > visibility.now;
}

export function visiblePhotos(photos: readonly StoredPhoto[], visibility: PhotoVisibility): StoredPhoto[] {
  return photos.filter((photo) => photoVisible(photo, visibility));
}

/** Somebody else's photos the server no longer keeps: each phone deletes them by itself. */
export function expiredPhotos(photos: readonly StoredPhoto[], now: Millis): StoredPhoto[] {
  return photos.filter((photo) => photo.memberId !== ME && photo.expiresAt !== null && photo.expiresAt <= now);
}

/** Whether a photo of the user's still has to reach the server. */
export function uploadPending(photo: Pick<StoredPhoto, 'memberId' | 'remoteState'>): boolean {
  return photo.memberId === ME && (photo.remoteState === 'queued' || photo.remoteState === 'posted');
}

/**
 * The user's photos the queue sends, oldest first: waiting to go up, with both files on
 * this phone. A row without its files (a restore brings rows, never files) has nothing
 * to send.
 */
export function uploadCandidates(photos: readonly StoredPhoto[]): StoredPhoto[] {
  return photos
    .filter((photo) => uploadPending(photo) && photo.fullFile !== null && photo.thumbFile !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * The photos of a challenge whose thumbnail this phone should fetch when the challenge
 * opens (`ensureChallengeThumbs`): drawn, with a key to open it, on the server, and no
 * thumbnail here yet. The user's own count too: a restore brings their rows back
 * without files.
 */
export function thumbsToFetch(
  photos: readonly StoredPhoto[],
  challengeId: string,
  visibility: PhotoVisibility,
): StoredPhoto[] {
  return photos.filter(
    (photo) =>
      photo.challengeId === challengeId &&
      photo.thumbFile === null &&
      photo.contentKey !== null &&
      (photo.remoteState === 'remote' || photo.remoteState === 'uploaded') &&
      photoVisible(photo, visibility),
  );
}

// --- What the server sends ---------------------------------------------------------------

/**
 * One `media` row of `/sync`, after this phone opened what it could: the owner is ME for
 * the user's own, the key is the one its wrap opened to (or null), and the caption is
 * the one the key opened (or null). `deletedAt` is a tombstone: the server deleted it.
 */
export type RemotePhoto = {
  id: string;
  challengeId: string;
  memberId: string;
  dayKey: DayKey;
  origin: PhotoOrigin;
  width: number;
  height: number;
  captionBox: string | null;
  contentKey: string | null;
  caption: string | null;
  createdAt: Millis;
  updatedAt: Millis;
  expiresAt: Millis | null;
  deletedAt: Millis | null;
};

/** What `mergeRemotePhotos` asks the store to do: rows to write, rows (and files) to delete. */
export type RemotePhotoPlan = { write: StoredPhoto[]; remove: StoredPhoto[] };

function hasFiles(photo: Pick<StoredPhoto, 'fullFile' | 'thumbFile'>): boolean {
  return photo.fullFile !== null || photo.thumbFile !== null;
}

function sameSlot(a: Pick<StoredPhoto, 'challengeId' | 'memberId' | 'dayKey'>, b: typeof a): boolean {
  return a.challengeId === b.challengeId && a.memberId === b.memberId && a.dayKey === b.dayKey;
}

/**
 * The server's rows, landed on this phone's (ADR-0051, tanda 2). The rules:
 *
 * - **Somebody else's tombstone** deletes the row and its files. So does a photo the
 *   user reported (`ignored`): it never comes back.
 * - **The user's own tombstone** (a moderator removed it, the user left the challenge, it
 *   expired on the server) does not take it off this phone: the user's photos stay until
 *   they archive the challenge (§13). It is `local` from then on. One that only ever came
 *   from the server (a restore, no files here) goes. One that was half sent goes back to
 *   the queue.
 * - **Somebody else's live photo** is written with what this phone already had of it:
 *   its files and its key are kept (a photo's key never changes, and a restore brings
 *   keys that no wrap for the new key can open). A newer photo on the same day of the
 *   same person replaces the older one, files and all; an older one arriving late is
 *   dropped.
 * - **The user's own live photo** is on the server with both files: `uploaded`, with the
 *   server's `expiresAt`. One this phone does not have (a restore) is written without
 *   files, when its key opened; if the user already has another photo on that day here,
 *   the one here wins, and the queue replaces the server's.
 *
 * Rows come in any order: they are applied oldest change first.
 */
export function mergeRemotePhotos(
  existing: readonly StoredPhoto[],
  incoming: readonly RemotePhoto[],
  ignored: ReadonlySet<string> = new Set(),
): RemotePhotoPlan {
  const rows = new Map(existing.map((photo) => [photo.id, photo]));
  const removed = new Map<string, StoredPhoto>();
  const written = new Set<string>();

  const remove = (photo: StoredPhoto): void => {
    rows.delete(photo.id);
    written.delete(photo.id);
    removed.set(photo.id, photo);
  };
  const write = (photo: StoredPhoto): void => {
    rows.set(photo.id, photo);
    written.add(photo.id);
    removed.delete(photo.id);
  };

  const ordered = [...incoming].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const remote of ordered) {
    const current = rows.get(remote.id);
    if (ignored.has(remote.id)) {
      if (current !== undefined) {
        remove(current);
      }
      continue;
    }

    if (remote.deletedAt !== null) {
      if (current === undefined) {
        continue;
      }
      if (current.memberId !== ME) {
        remove(current);
      } else if (current.remoteState === 'posted' || current.remoteState === 'queued') {
        write({ ...current, remoteState: 'queued', expiresAt: null });
      } else if (hasFiles(current)) {
        write({ ...current, remoteState: 'local', expiresAt: null });
      } else {
        remove(current);
      }
      continue;
    }

    if (remote.memberId === ME) {
      if (current !== undefined) {
        write({
          ...current,
          remoteState: 'uploaded',
          expiresAt: remote.expiresAt,
          contentKey: current.contentKey ?? remote.contentKey,
          captionBox: current.captionBox ?? remote.captionBox,
        });
        continue;
      }
      const occupied = [...rows.values()].some((photo) => sameSlot(photo, remote));
      if (occupied || remote.contentKey === null) {
        continue;
      }
      write(fromRemote(remote, null, 'uploaded'));
      continue;
    }

    // Somebody else's, alive.
    const other = [...rows.values()].find((photo) => photo.id !== remote.id && sameSlot(photo, remote));
    if (other !== undefined) {
      if (other.createdAt > remote.createdAt) {
        continue;
      }
      remove(other);
    }
    write(fromRemote(remote, current ?? null, 'remote'));
  }

  return {
    write: [...written].map((id) => rows.get(id)).filter((photo): photo is StoredPhoto => photo !== undefined),
    remove: [...removed.values()],
  };
}

/** A server row as a stored photo, keeping what this phone already had of it. */
function fromRemote(remote: RemotePhoto, current: StoredPhoto | null, remoteState: 'remote' | 'uploaded'): StoredPhoto {
  const caption = current?.caption ?? (remote.caption === null ? null : cleanCaption(remote.caption));
  return {
    id: remote.id,
    challengeId: remote.challengeId,
    memberId: remote.memberId,
    dayKey: remote.dayKey,
    origin: remote.origin,
    caption,
    width: remote.width,
    height: remote.height,
    fullFile: current?.fullFile ?? null,
    thumbFile: current?.thumbFile ?? null,
    takenAt: remote.createdAt,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    contentKey: current?.contentKey ?? remote.contentKey,
    remoteState,
    expiresAt: remote.expiresAt,
    captionBox: remote.captionBox,
  };
}
