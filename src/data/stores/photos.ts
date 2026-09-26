import { create } from 'zustand';

import * as circleRepo from '../../db/repositories/circle';
import * as photosRepo from '../../db/repositories/photos';
import * as settingsRepo from '../../db/repositories/settings';
import { expiredPhotos, mergeRemotePhotos, photoAudience, type RemotePhoto } from '../../domain/photoSharing';
import { cleanCaption } from '../../domain/photos';
import {
  ME,
  type DayKey,
  type PhotoOrigin,
  type PhotoShare,
  type StoredPhoto,
} from '../../domain/types';
import {
  deleteAllPhotoFiles,
  deletePhotoFiles,
  type PickedPhoto,
  type PreparedPhoto,
} from '../../platform/camera';

/**
 * The photos pinned to challenge days (ADR-0051), cached in memory from SQLite like
 * every other store here: each action writes through the repository first, then the
 * cache. The files are the other half of a photo and live behind `platform/camera`;
 * every delete here removes the row and then its files, so a row never names a file that
 * was already deleted, and at worst a file outlives its row.
 *
 * Since tanda 2 the rows are other people's too, and the user's may leave the phone,
 * sealed (src/platform/photoSync.ts carries them; this store never talks to a server):
 *
 * - `savePhoto` queues the photo when somebody else can see it (`photoAudience`): the
 *   challenge has photos, there is a circle account, and another participant has
 *   published a key. Otherwise it stays `local`, as in tanda 1.
 * - `removePhoto` of one that reached the server queues its `DELETE`.
 * - `applyRemote` lands what `/sync` sent, already opened (`mergeRemotePhotos`).
 * - Small lists in the settings table, like the circle's queues: the people whose photos
 *   the user hid, the circle's published keys, the deletes and reports still to send,
 *   the photos the user reported, and when the user accepted the terms of the first
 *   shared photo.
 *
 * Nothing here checks whether a day may carry a photo: that is `domain/photos.photoSlot`,
 * which the screen asks through `useMyPhotoSlot` before a photo is taken. Nothing here
 * touches a mark either: a photo is testimony, and a mark is counted the same with or
 * without one.
 */

/** The settings keys of this store (docs/DATA_MODEL.md). */
export const PHOTO_KEYS = {
  /** Account ids whose photos the user does not want to see. Only for the user. */
  hiddenMembers: 'photo_hidden_members',
  /** `{ [accountId]: { boxKey, keyId } }`: the circle's published keys, as the last sync said. */
  boxKeys: 'photo_box_keys',
  /** Ids of the user's photos whose `DELETE /media` has not reached the server. */
  pendingDeletes: 'photo_pending_deletes',
  /** Reports made here that have not reached the server, with the key they reveal. */
  pendingReports: 'photo_pending_reports',
  /** Ids of photos the user reported: gone from here, and never let back in. */
  reported: 'photo_reported',
  /** When the user accepted what sharing a photo means ("Entendido"), epoch ms. */
  termsAcceptedAt: 'photo_terms_accepted_at',
} as const;

/** A published key of the circle: the X25519 public key and its id, base64 and hex. */
export type MemberBoxKey = { boxKey: string; keyId: string };

/** Why a photo was reported, as the server takes it. */
export type PhotoReportReason = 'unwanted' | 'consent' | 'minor' | 'other';

export const PHOTO_REPORT_REASONS: readonly PhotoReportReason[] = ['unwanted', 'consent', 'minor', 'other'];

/** At most this many characters of note go with a report (the server's cap). */
export const PHOTO_REPORT_NOTE_MAX = 200;

/** A report still to send. `contentKey` is the photo's own key: what lets the server check it. */
export type PendingReport = {
  mediaId: string;
  reason: PhotoReportReason;
  note: string | null;
  contentKey: string;
};

type SavePhotoInput = {
  challengeId: string;
  dayKey: DayKey;
  prepared: PreparedPhoto;
  origin: PhotoOrigin;
  caption: string | null;
  /** The draft's id: its files are already named after it. */
  id: string;
};

type PhotoState = {
  photos: StoredPhoto[];
  hiddenMembers: string[];
  boxKeys: Record<string, MemberBoxKey>;
  pendingDeletes: string[];
  pendingReports: PendingReport[];
  reported: string[];
  termsAcceptedAt: number | null;
  /** Reads every photo, and the lists, from the database. At boot, after a reset and after a restore. */
  hydrate: () => void;
  /**
   * Upsert for (challengeId, ME, dayKey): the new photo replaces the old one entirely
   * (row and files) and the caption is cleaned again (`cleanCaption`). Consumes the draft
   * with the same id without deleting its files: they are this photo's now. Queued for
   * the server when somebody else can see it (`photoAudience`); a replaced photo that had
   * reached the server gets its `DELETE` queued.
   */
  savePhoto: (input: SavePhotoInput, now: number) => StoredPhoto;
  /** "Quitar la foto": the row and its files, and its `DELETE` queued if it went up. The mark stays. */
  removePhoto: (id: string, now: number) => void;
  /** Archiving a challenge takes its photos with it, rows and files. */
  removeChallengePhotos: (challengeId: string) => void;
  /**
   * Leaving a challenge: the other people's photos in it go, rows and files (the server
   * stops handing their files to the user). The user's own stay until the archive.
   */
  removeOthersPhotos: (challengeId: string) => void;
  /** A person out of the circle goes with their photos, like with their marks. */
  removeMemberPhotos: (memberId: string) => void;
  /**
   * Photos of challenges that are gone: archived, deleted with the sample data, or not in
   * a database a restore brought. Takes the ids of the challenges still open; everything
   * else goes, rows and files. Returns how many went.
   */
  removeOrphans: (openChallengeIds: Iterable<string>) => number;
  /** "Borrar todo y reiniciar": every row and the whole photos directory. */
  clear: () => void;

  // --- Shared (tanda 2), written by src/platform/photoSync.ts ---------------------------
  /** What `/sync` sent, already opened on this phone (`mergeRemotePhotos`), and what expired. */
  applyRemote: (rows: readonly RemotePhoto[], now: number) => void;
  /** Other people's photos past `expiresAt`, rows and files. Returns how many went. */
  expire: (now: number) => number;
  /** One step of an upload: the key, the state, the server's expiry, the sealed caption. */
  setShare: (id: string, patch: Partial<PhotoShare>, now: number) => void;
  /**
   * A file of a photo just written (a download). When the row is gone meanwhile (a
   * tombstone arrived), the file is deleted instead: no file outlives the sync that
   * deleted its row.
   */
  setFile: (id: string, variant: 'full' | 'thumb', name: string) => void;
  /** The circle's keys, as a sync gives them: the whole list replaces what was here. */
  setBoxKeys: (keys: readonly ({ id: string } & MemberBoxKey)[], now: number) => void;
  /** Keys the server said are current (a `409 stale keys`), merged over the stored ones. */
  mergeBoxKeys: (keys: readonly ({ id: string } & MemberBoxKey)[], now: number) => void;
  /** The server has the `DELETE` (or never had the photo): stop sending it. */
  settleDelete: (id: string, now: number) => void;
  /**
   * "Reportar la foto", the local half (ADR-0051 §18): the photo goes from this phone —
   * row and files — and never comes back, and the report waits in a queue until the
   * server has it. Null when there is no such photo, or no key to reveal.
   */
  reportPhoto: (id: string, reason: PhotoReportReason, note: string | null, now: number) => PendingReport | null;
  /** The server has the report (or refused it for good): stop sending it. */
  settleReport: (mediaId: string, now: number) => void;
  /** "Ocultar las fotos de Ana": nothing is deleted, the screens stop drawing them. */
  hideMember: (memberId: string, now: number) => void;
  /** "Mostrar", in Ajustes › Círculo › Fotos ocultas. */
  showMember: (memberId: string, now: number) => void;
  /** "Entendido" on the notice before the first shared photo. */
  acceptTerms: (now: number) => void;
  /**
   * The circle account went ("Borrar la cuenta"): the queues and keys were that account's.
   * The photos themselves go with the challenges the store archives.
   */
  forgetSharing: (now: number) => void;
};

/** The files of rows already deleted. Nothing is asked of the platform for no photos. */
function deleteFilesOf(photos: readonly StoredPhoto[]): void {
  if (photos.length > 0) {
    deletePhotoFiles(photos.flatMap((photo) => [photo.fullFile, photo.thumbFile]));
  }
}

// --- Reading the lists back ---------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string' && entry !== '') : [];
}

export function readBoxKeys(raw: unknown): Record<string, MemberBoxKey> {
  const keys: Record<string, MemberBoxKey> = {};
  if (!isRecord(raw)) {
    return keys;
  }
  for (const [id, value] of Object.entries(raw)) {
    if (isRecord(value) && typeof value.boxKey === 'string' && typeof value.keyId === 'string') {
      if (value.boxKey !== '' && value.keyId !== '') {
        keys[id] = { boxKey: value.boxKey, keyId: value.keyId };
      }
    }
  }
  return keys;
}

function isReason(value: unknown): value is PhotoReportReason {
  return typeof value === 'string' && (PHOTO_REPORT_REASONS as readonly string[]).includes(value);
}

export function readPendingReports(raw: unknown): PendingReport[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const reports: PendingReport[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }
    const { mediaId, reason, note, contentKey } = entry;
    if (typeof mediaId !== 'string' || typeof contentKey !== 'string' || !isReason(reason)) {
      continue;
    }
    reports.push({ mediaId, reason, note: typeof note === 'string' && note !== '' ? note : null, contentKey });
  }
  return reports;
}

function readInstant(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** A report's note: one line, trimmed, at most PHOTO_REPORT_NOTE_MAX characters; '' is none. */
export function cleanReportNote(note: string | null): string | null {
  if (note === null) {
    return null;
  }
  const flat = note.replace(/\s+/g, ' ').trim();
  const cut = Array.from(flat).slice(0, PHOTO_REPORT_NOTE_MAX).join('').trimEnd();
  return cut === '' ? null : cut;
}

/**
 * Whether a new photo of the user's in `challengeId` is seen by somebody else, read from
 * the database (the circle store imports this one, so this one reads the circle through
 * its repositories): the challenge, the members, the account marker, and the keys this
 * store holds.
 */
function shareable(challengeId: string, boxKeys: Record<string, MemberBoxKey>): boolean {
  const challenge = circleRepo.listChallenges().find((candidate) => candidate.id === challengeId);
  if (challenge === undefined) {
    return false;
  }
  const audience = photoAudience({
    challenge,
    members: circleRepo.listMembers(),
    keyHolders: new Set(Object.keys(boxKeys)),
    sharing: settingsRepo.getAccount() !== null,
  });
  return audience.length > 0;
}

/** Whether a photo of the user's reached the server in some form, so a `DELETE` is owed. */
function wentUp(photo: StoredPhoto): boolean {
  return (
    photo.memberId === ME &&
    (photo.remoteState === 'posted' ||
      photo.remoteState === 'uploaded' ||
      (photo.remoteState === 'queued' && photo.contentKey !== null))
  );
}

export const usePhotoStore = create<PhotoState>((set, get) => {
  const saveIds = (key: 'hiddenMembers' | 'pendingDeletes' | 'reported', next: string[], now: number): void => {
    settingsRepo.setJson(PHOTO_KEYS[key], next, now);
    set({ [key]: next } as Pick<PhotoState, typeof key>);
  };

  const addId = (key: 'hiddenMembers' | 'pendingDeletes' | 'reported', id: string, now: number): void => {
    if (!get()[key].includes(id)) {
      saveIds(key, [...get()[key], id], now);
    }
  };

  const dropId = (key: 'hiddenMembers' | 'pendingDeletes' | 'reported', id: string, now: number): void => {
    if (get()[key].includes(id)) {
      saveIds(
        key,
        get()[key].filter((entry) => entry !== id),
        now,
      );
    }
  };

  const saveBoxKeys = (boxKeys: Record<string, MemberBoxKey>, now: number): void => {
    settingsRepo.setJson(PHOTO_KEYS.boxKeys, boxKeys, now);
    set({ boxKeys });
  };

  /** Deletes these rows, then their files, then the cache. */
  const dropRows = (gone: readonly StoredPhoto[]): void => {
    if (gone.length === 0) {
      return;
    }
    photosRepo.deletePhotos(gone.map((photo) => photo.id));
    deleteFilesOf(gone);
    const ids = new Set(gone.map((photo) => photo.id));
    set((state) => ({ photos: state.photos.filter((photo) => !ids.has(photo.id)) }));
  };

  return {
    photos: [],
    hiddenMembers: [],
    boxKeys: {},
    pendingDeletes: [],
    pendingReports: [],
    reported: [],
    termsAcceptedAt: null,

    hydrate: () => {
      set({
        photos: photosRepo.listPhotos(),
        hiddenMembers: readIds(settingsRepo.getJson<unknown>(PHOTO_KEYS.hiddenMembers)),
        boxKeys: readBoxKeys(settingsRepo.getJson<unknown>(PHOTO_KEYS.boxKeys)),
        pendingDeletes: readIds(settingsRepo.getJson<unknown>(PHOTO_KEYS.pendingDeletes)),
        pendingReports: readPendingReports(settingsRepo.getJson<unknown>(PHOTO_KEYS.pendingReports)),
        reported: readIds(settingsRepo.getJson<unknown>(PHOTO_KEYS.reported)),
        termsAcceptedAt: readInstant(settingsRepo.getJson<unknown>(PHOTO_KEYS.termsAcceptedAt)),
      });
    },

    savePhoto: (input, now) => {
      const previous = photosRepo.findPhotoAt(input.challengeId, ME, input.dayKey);
      const sameAgain = previous !== null && previous.id === input.id;
      // The same photo saved again keeps where it stands: a second row for one id is not
      // something the server can be asked for.
      const share: PhotoShare =
        sameAgain && previous.remoteState !== 'local'
          ? {
              contentKey: previous.contentKey,
              remoteState: previous.remoteState,
              expiresAt: previous.expiresAt,
              captionBox: previous.captionBox,
            }
          : {
              contentKey: null,
              remoteState: shareable(input.challengeId, get().boxKeys) ? 'queued' : 'local',
              expiresAt: null,
              captionBox: null,
            };
      const photo: StoredPhoto = {
        id: input.id,
        challengeId: input.challengeId,
        memberId: ME,
        dayKey: input.dayKey,
        origin: input.origin,
        caption: input.caption === null ? null : cleanCaption(input.caption),
        width: input.prepared.width,
        height: input.prepared.height,
        fullFile: input.prepared.fullFile,
        thumbFile: input.prepared.thumbFile,
        takenAt: now,
        createdAt: now,
        updatedAt: now,
        ...share,
      };
      photosRepo.replacePhoto(photo);
      // The old photo's files, unless they are this photo's (the same id saved again).
      if (previous !== null && !sameAgain) {
        deleteFilesOf([previous]);
        if (wentUp(previous)) {
          // A new upload replaces it on the server by itself; one that never goes up
          // would not, so the delete is owed either way (and costs nothing twice).
          addId('pendingDeletes', previous.id, now);
        }
      }
      set((state) => ({
        photos: [
          ...state.photos.filter(
            (p) =>
              p.id !== photo.id &&
              !(p.challengeId === photo.challengeId && p.memberId === photo.memberId && p.dayKey === photo.dayKey),
          ),
          photo,
        ],
      }));
      if (usePhotoDraftStore.getState().draft?.id === photo.id) {
        usePhotoDraftStore.setState({ draft: null });
      }
      return photo;
    },

    removePhoto: (id, now) => {
      const photo = photosRepo.findPhoto(id);
      photosRepo.deletePhoto(id);
      if (photo !== null) {
        deleteFilesOf([photo]);
        if (wentUp(photo)) {
          addId('pendingDeletes', id, now);
        }
      }
      set((state) => ({ photos: state.photos.filter((p) => p.id !== id) }));
    },

    removeChallengePhotos: (challengeId) => {
      // The database's list, not the cache's: the files of every row it holds must go.
      const gone = photosRepo.listChallengePhotos(challengeId);
      photosRepo.deleteChallengePhotos(challengeId);
      deleteFilesOf(gone);
      set((state) => ({ photos: state.photos.filter((p) => p.challengeId !== challengeId) }));
    },

    removeOthersPhotos: (challengeId) => {
      dropRows(photosRepo.listChallengePhotos(challengeId).filter((photo) => photo.memberId !== ME));
    },

    removeMemberPhotos: (memberId) => {
      const gone = photosRepo.listMemberPhotos(memberId);
      photosRepo.deleteMemberPhotos(memberId);
      deleteFilesOf(gone);
      set((state) => ({ photos: state.photos.filter((p) => p.memberId !== memberId) }));
    },

    removeOrphans: (openChallengeIds) => {
      const open = new Set(openChallengeIds);
      const orphaned = [...new Set(get().photos.map((p) => p.challengeId))].filter((id) => !open.has(id));
      for (const challengeId of orphaned) {
        get().removeChallengePhotos(challengeId);
      }
      return orphaned.length;
    },

    clear: () => {
      photosRepo.deleteAllPhotos();
      deleteAllPhotoFiles();
      usePhotoDraftStore.setState({ draft: null });
      usePhotoTransferStore.setState({ running: {}, failures: {} });
      set({
        photos: [],
        hiddenMembers: [],
        boxKeys: {},
        pendingDeletes: [],
        pendingReports: [],
        reported: [],
        termsAcceptedAt: null,
      });
    },

    applyRemote: (rows, now) => {
      if (rows.length > 0) {
        const plan = mergeRemotePhotos(get().photos, rows, new Set(get().reported));
        // The writes first: a photo that replaces another on its day takes the slot in the
        // same statement that frees it. Then the deletes, then their files.
        photosRepo.replacePhotos(plan.write);
        if (plan.remove.length > 0) {
          photosRepo.deletePhotos(plan.remove.map((photo) => photo.id));
          // A file a written row still names is kept: the same name, a newer row.
          const kept = new Set(plan.write.flatMap((photo) => [photo.fullFile, photo.thumbFile]));
          deletePhotoFiles(
            plan.remove.flatMap((photo) => [photo.fullFile, photo.thumbFile]).filter((name) => !kept.has(name)),
          );
        }
        const removed = new Set(plan.remove.map((photo) => photo.id));
        const written = new Map(plan.write.map((photo) => [photo.id, photo]));
        set((state) => {
          const left = state.photos
            .filter((photo) => !removed.has(photo.id) && !written.has(photo.id))
            .filter(
              (photo) =>
                !plan.write.some(
                  (w) => w.challengeId === photo.challengeId && w.memberId === photo.memberId && w.dayKey === photo.dayKey,
                ),
            );
          return { photos: [...left, ...plan.write] };
        });
      }
      get().expire(now);
    },

    expire: (now) => {
      const gone = expiredPhotos(get().photos, now);
      dropRows(gone);
      return gone.length;
    },

    setShare: (id, patch, now) => {
      if (!get().photos.some((photo) => photo.id === id)) {
        return;
      }
      photosRepo.updateShare(id, patch, now);
      set((state) => ({
        photos: state.photos.map((photo) => (photo.id === id ? { ...photo, ...patch, updatedAt: now } : photo)),
      }));
    },

    setFile: (id, variant, name) => {
      if (!get().photos.some((photo) => photo.id === id)) {
        deletePhotoFiles([name]);
        return;
      }
      photosRepo.setPhotoFile(id, variant, name);
      set((state) => ({
        photos: state.photos.map((photo) =>
          photo.id !== id ? photo : variant === 'full' ? { ...photo, fullFile: name } : { ...photo, thumbFile: name },
        ),
      }));
    },

    setBoxKeys: (keys, now) => {
      const next: Record<string, MemberBoxKey> = {};
      for (const key of keys) {
        next[key.id] = { boxKey: key.boxKey, keyId: key.keyId };
      }
      const current = get().boxKeys;
      const same =
        Object.keys(next).length === Object.keys(current).length &&
        Object.entries(next).every(([id, key]) => current[id]?.keyId === key.keyId && current[id]?.boxKey === key.boxKey);
      if (!same) {
        saveBoxKeys(next, now);
      }
    },

    mergeBoxKeys: (keys, now) => {
      if (keys.length === 0) {
        return;
      }
      const next = { ...get().boxKeys };
      for (const key of keys) {
        next[key.id] = { boxKey: key.boxKey, keyId: key.keyId };
      }
      saveBoxKeys(next, now);
    },

    settleDelete: (id, now) => {
      dropId('pendingDeletes', id, now);
    },

    reportPhoto: (id, reason, note, now) => {
      const photo = get().photos.find((candidate) => candidate.id === id) ?? photosRepo.findPhoto(id);
      if (photo === null || photo.memberId === ME || photo.contentKey === null) {
        return null;
      }
      const report: PendingReport = { mediaId: id, reason, note: cleanReportNote(note), contentKey: photo.contentKey };
      const pendingReports = [...get().pendingReports.filter((entry) => entry.mediaId !== id), report];
      settingsRepo.setJson(PHOTO_KEYS.pendingReports, pendingReports, now);
      set({ pendingReports });
      addId('reported', id, now);
      dropRows([photo]);
      return report;
    },

    settleReport: (mediaId, now) => {
      const pendingReports = get().pendingReports.filter((entry) => entry.mediaId !== mediaId);
      if (pendingReports.length === get().pendingReports.length) {
        return;
      }
      settingsRepo.setJson(PHOTO_KEYS.pendingReports, pendingReports, now);
      set({ pendingReports });
    },

    hideMember: (memberId, now) => {
      if (memberId !== ME) {
        addId('hiddenMembers', memberId, now);
      }
    },

    showMember: (memberId, now) => {
      dropId('hiddenMembers', memberId, now);
    },

    acceptTerms: (now) => {
      settingsRepo.setJson(PHOTO_KEYS.termsAcceptedAt, now, now);
      set({ termsAcceptedAt: now });
    },

    forgetSharing: (now) => {
      settingsRepo.setJson(PHOTO_KEYS.pendingDeletes, [], now);
      settingsRepo.setJson(PHOTO_KEYS.pendingReports, [], now);
      settingsRepo.setJson(PHOTO_KEYS.boxKeys, {}, now);
      set({ pendingDeletes: [], pendingReports: [], boxKeys: {} });
    },
  };
});

// --- Transfers ------------------------------------------------------------------------

/**
 * Why a photo could not be fetched, for the line the viewer shows (rule 8):
 * - `offline`: nobody answered. It is fetched again the next time it is opened.
 * - `gone`: the server no longer has it for the user (deleted, expired, or the user is
 *   no longer in the challenge).
 * - `failed`: it arrived and could not be opened or written.
 * - `unavailable`: this build or this phone cannot do it (no cipher, no account, no key).
 */
export type PhotoFetchFailure = 'offline' | 'gone' | 'failed' | 'unavailable';

/** `${id}:${variant}`: one download of one file of one photo. */
export function transferKey(id: string, variant: 'full' | 'thumb'): string {
  return `${id}:${variant}`;
}

type PhotoTransferState = {
  /** Downloads on their way. */
  running: Record<string, true>;
  /** The last download of each file that did not end with the file here. */
  failures: Record<string, PhotoFetchFailure>;
};

/** Ephemeral: what the downloads are doing now. Written by platform/photoSync only. */
export const usePhotoTransferStore = create<PhotoTransferState>(() => ({ running: {}, failures: {} }));

// --- The draft ------------------------------------------------------------------------

/**
 * A photo taken or chosen and prepared, not yet saved: what `circle/photo-new` shows.
 * Its files are already written under `id`, which becomes the photo's id on save.
 */
export type PhotoDraft = {
  id: string;
  challengeId: string;
  dayKey: DayKey;
  picked: PickedPhoto;
  prepared: PreparedPhoto;
};

type PhotoDraftState = {
  draft: PhotoDraft | null;
  /** Holds a new draft; an older one that was never saved has its files deleted. */
  setDraft: (draft: PhotoDraft) => void;
  /**
   * Cancel: the draft goes and so do its files — unless a photo with its id was saved,
   * whose files they are now. Safe to call after saving, and when there is no draft.
   */
  discard: () => void;
};

function isSaved(id: string): boolean {
  return usePhotoStore.getState().photos.some((photo) => photo.id === id);
}

function dropFiles(draft: PhotoDraft): void {
  if (!isSaved(draft.id)) {
    deletePhotoFiles([draft.prepared.fullFile, draft.prepared.thumbFile]);
  }
}

/** Ephemeral: never persisted. A draft left behind by a killed app is only two files. */
export const usePhotoDraftStore = create<PhotoDraftState>((set, get) => ({
  draft: null,

  setDraft: (draft) => {
    const previous = get().draft;
    if (previous !== null && previous.id !== draft.id) {
      dropFiles(previous);
    }
    set({ draft });
  },

  discard: () => {
    const draft = get().draft;
    if (draft === null) {
      return;
    }
    dropFiles(draft);
    set({ draft: null });
  },
}));
