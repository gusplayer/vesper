import { create } from 'zustand';

import * as photosRepo from '../../db/repositories/photos';
import { cleanCaption } from '../../domain/photos';
import { ME, type ChallengePhoto, type DayKey, type PhotoOrigin } from '../../domain/types';
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
 * Tanda 1 only ever writes the user's own photos (ME). The rows of other people will
 * arrive with the shared tanda through the same table.
 *
 * Nothing here checks whether a day may carry a photo: that is `domain/photos.photoSlot`,
 * which the screen asks through `useMyPhotoSlot` before a photo is taken. Nothing here
 * touches a mark either: a photo is testimony, and a mark is counted the same with or
 * without one.
 */

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
  photos: ChallengePhoto[];
  /** Reads every photo from the database. At boot, after a reset and after a restore. */
  hydrate: () => void;
  /**
   * Upsert for (challengeId, ME, dayKey): the new photo replaces the old one entirely
   * (row and files) and the caption is cleaned again (`cleanCaption`). Consumes the draft
   * with the same id without deleting its files: they are this photo's now.
   */
  savePhoto: (input: SavePhotoInput, now: number) => ChallengePhoto;
  /** "Quitar la foto": the row and its files. The mark stays as it was. */
  removePhoto: (id: string, now: number) => void;
  /** Archiving a challenge takes its photos with it, rows and files. */
  removeChallengePhotos: (challengeId: string) => void;
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
};

/** The files of rows already deleted. Nothing is asked of the platform for no photos. */
function deleteFilesOf(photos: readonly ChallengePhoto[]): void {
  if (photos.length > 0) {
    deletePhotoFiles(photos.flatMap((photo) => [photo.fullFile, photo.thumbFile]));
  }
}

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],

  hydrate: () => {
    set({ photos: photosRepo.listPhotos() });
  },

  savePhoto: (input, now) => {
    const previous = photosRepo.findPhotoAt(input.challengeId, ME, input.dayKey);
    const photo: ChallengePhoto = {
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
    };
    photosRepo.replacePhoto(photo);
    // The old photo's files, unless they are this photo's (the same id saved again).
    if (previous !== null && previous.id !== photo.id) {
      deleteFilesOf([previous]);
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

  removePhoto: (id) => {
    const photo = photosRepo.findPhoto(id);
    photosRepo.deletePhoto(id);
    if (photo !== null) {
      deleteFilesOf([photo]);
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
    set({ photos: [] });
  },
}));

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
