import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeDb, transactionOn, type FakeRows } from '../../db/testing/fakeDb';
import { ME, type ChallengePhoto } from '../../domain/types';
import { usePhotoDraftStore, usePhotoStore, type PhotoDraft } from './photos';

/**
 * The photo store against a fake database and a fake photos directory: every write goes
 * through the repository before the cache, and every delete removes the row before its
 * files, so a row never names a file that is already gone (ADR-0051).
 */

let fake = createFakeDb();

vi.mock('../../db/client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

const files = vi.hoisted(() => ({
  /** Every name handed to deletePhotoFiles, with how many SQL calls had run by then. */
  deleted: [] as { names: (string | null)[]; afterCalls: number }[],
  wiped: [] as number[],
}));

vi.mock('../../platform/camera', () => ({
  deletePhotoFiles: (names: readonly (string | null)[]) => {
    files.deleted.push({ names: [...names], afterCalls: fake.calls.length });
  },
  deleteAllPhotoFiles: () => {
    files.wiped.push(fake.calls.length);
  },
}));

const T0 = 1_700_000_000_000;

function rowOf(photo: ChallengePhoto) {
  return {
    id: photo.id,
    challenge_id: photo.challengeId,
    member_id: photo.memberId,
    day_key: photo.dayKey,
    origin: photo.origin,
    caption: photo.caption,
    width: photo.width,
    height: photo.height,
    full_file: photo.fullFile,
    thumb_file: photo.thumbFile,
    taken_at: photo.takenAt,
    created_at: photo.createdAt,
    updated_at: photo.updatedAt,
  };
}

function aPhoto(overrides: Partial<ChallengePhoto> = {}): ChallengePhoto {
  const id = overrides.id ?? 'p-old';
  return {
    id,
    challengeId: 'c-read',
    memberId: ME,
    dayKey: '2026-09-22',
    origin: 'library',
    caption: null,
    width: 1280,
    height: 960,
    fullFile: `${id}.jpg`,
    thumbFile: `${id}.thumb.jpg`,
    takenAt: T0,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function prepared(id: string) {
  return { fullFile: `${id}.jpg`, thumbFile: `${id}.thumb.jpg`, width: 1280, height: 720 };
}

function draft(id: string): PhotoDraft {
  return {
    id,
    challengeId: 'c-read',
    dayKey: '2026-09-22',
    picked: { uri: `file:///cache/${id}.heic`, width: 4032, height: 2268, origin: 'camera' },
    prepared: prepared(id),
  };
}

/** A database holding these photos, hydrated into the store. */
function withPhotos(...photos: ChallengePhoto[]): void {
  fake = createFakeDb();
  fake.whenSql('ORDER BY challenge_id, day_key, member_id', photos.map(rowOf));
  usePhotoStore.getState().hydrate();
  fake.calls.length = 0;
}

beforeEach(() => {
  fake = createFakeDb();
  files.deleted.length = 0;
  files.wiped.length = 0;
  usePhotoStore.setState({ photos: [] });
  usePhotoDraftStore.setState({ draft: null });
});

describe('hydrate', () => {
  it('reads every photo from the database', () => {
    withPhotos(aPhoto(), aPhoto({ id: 'p-ana', memberId: 'ana' }));

    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-old', 'p-ana']);
  });
});

describe('savePhoto', () => {
  it('writes the row through the repository, then caches it as the user own', () => {
    const saved = usePhotoStore.getState().savePhoto(
      { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared('p-new'), origin: 'camera', caption: null, id: 'p-new' },
      T0 + 5,
    );

    expect(saved).toEqual({
      id: 'p-new',
      challengeId: 'c-read',
      memberId: ME,
      dayKey: '2026-09-22',
      origin: 'camera',
      caption: null,
      width: 1280,
      height: 720,
      fullFile: 'p-new.jpg',
      thumbFile: 'p-new.thumb.jpg',
      takenAt: T0 + 5,
      createdAt: T0 + 5,
      updatedAt: T0 + 5,
    });
    expect(fake.callMatching(/INSERT INTO challenge_photos/).params?.[0]).toBe('p-new');
    expect(usePhotoStore.getState().photos).toEqual([saved]);
    expect(files.deleted).toEqual([]);
  });

  it('cleans the caption again: one line, 80 characters, nothing but spaces is none', () => {
    const save = (caption: string | null, id: string) =>
      usePhotoStore
        .getState()
        .savePhoto({ challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared(id), origin: 'camera', caption, id }, T0);

    expect(save('  Pierna,\npor fin. ', 'p-1').caption).toBe('Pierna, por fin.');
    expect(save('a'.repeat(100), 'p-2').caption).toBe('a'.repeat(80));
    expect(save(' \n ', 'p-3').caption).toBeNull();
  });

  it('replaces the photo of that day: one row left, the old files deleted after its row', () => {
    const old = aPhoto();
    withPhotos(old);
    fake.whenSql('LIMIT 1', [rowOf(old)]);

    usePhotoStore.getState().savePhoto(
      { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared('p-new'), origin: 'library', caption: null, id: 'p-new' },
      T0 + 10,
    );

    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-new']);
    expect(files.deleted).toHaveLength(1);
    expect(files.deleted[0]?.names).toEqual(['p-old.jpg', 'p-old.thumb.jpg']);
    const commit = fake.calls.findIndex((call) => call.sql === 'COMMIT');
    expect(files.deleted[0]?.afterCalls).toBeGreaterThan(commit);
  });

  it('keeps the files when the same photo is saved again', () => {
    const same = aPhoto({ id: 'p-new' });
    withPhotos(same);
    fake.whenSql('LIMIT 1', [rowOf(same)]);

    usePhotoStore.getState().savePhoto(
      { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared('p-new'), origin: 'library', caption: 'otra', id: 'p-new' },
      T0 + 10,
    );

    expect(files.deleted).toEqual([]);
    expect(usePhotoStore.getState().photos).toHaveLength(1);
    expect(usePhotoStore.getState().photos[0]?.caption).toBe('otra');
  });

  it('leaves the photos of other days, people and challenges alone', () => {
    withPhotos(
      aPhoto({ id: 'p-monday', dayKey: '2026-09-21' }),
      aPhoto({ id: 'p-ana', memberId: 'ana' }),
      aPhoto({ id: 'p-walk', challengeId: 'c-walk' }),
    );

    usePhotoStore.getState().savePhoto(
      { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared('p-new'), origin: 'camera', caption: null, id: 'p-new' },
      T0,
    );

    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-monday', 'p-ana', 'p-walk', 'p-new']);
  });

  it('consumes the draft it was made from, without deleting its files', () => {
    usePhotoDraftStore.getState().setDraft(draft('p-new'));

    usePhotoStore.getState().savePhoto(
      { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared('p-new'), origin: 'camera', caption: null, id: 'p-new' },
      T0,
    );

    expect(usePhotoDraftStore.getState().draft).toBeNull();
    expect(files.deleted).toEqual([]);
  });

  it('never touches a mark', () => {
    usePhotoStore.getState().savePhoto(
      { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared('p-new'), origin: 'camera', caption: null, id: 'p-new' },
      T0,
    );

    expect(fake.calls.some((call) => /habit_marks|challenge_marks/.test(call.sql))).toBe(false);
  });
});

describe('removePhoto', () => {
  it('deletes the row, then its files, then the cache; the mark stays', () => {
    const photo = aPhoto();
    withPhotos(photo, aPhoto({ id: 'p-other', dayKey: '2026-09-21' }));
    fake.whenSql('WHERE id = ? LIMIT 1', [rowOf(photo)]);

    usePhotoStore.getState().removePhoto('p-old', T0);

    const deleteRow = fake.calls.findIndex((call) => call.sql === 'DELETE FROM challenge_photos WHERE id = ?');
    expect(deleteRow).toBeGreaterThanOrEqual(0);
    expect(files.deleted).toEqual([{ names: ['p-old.jpg', 'p-old.thumb.jpg'], afterCalls: deleteRow + 1 }]);
    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-other']);
    expect(fake.calls.some((call) => /habit_marks|challenge_marks/.test(call.sql))).toBe(false);
  });

  it('deletes no file for a row the database does not have', () => {
    usePhotoStore.getState().removePhoto('p-nowhere', T0);

    expect(files.deleted).toEqual([]);
  });
});

describe('removeChallengePhotos', () => {
  it("deletes every row the database holds for that challenge, then their files, and nobody else's", () => {
    const first = aPhoto({ id: 'p-1', dayKey: '2026-09-21' });
    const second = aPhoto({ id: 'p-2', dayKey: '2026-09-22', thumbFile: null });
    withPhotos(first, second, aPhoto({ id: 'p-walk', challengeId: 'c-walk' }));
    fake.whenSql('WHERE challenge_id = ? ORDER BY', [rowOf(first), rowOf(second)]);

    usePhotoStore.getState().removeChallengePhotos('c-read');

    expect(fake.callMatching('DELETE FROM challenge_photos WHERE challenge_id = ?').params).toEqual(['c-read']);
    expect(files.deleted).toHaveLength(1);
    expect(files.deleted[0]?.names).toEqual(['p-1.jpg', 'p-1.thumb.jpg', 'p-2.jpg', null]);
    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-walk']);
  });
});

describe('removeMemberPhotos', () => {
  it("deletes that person's rows and files in every challenge", () => {
    const anas = aPhoto({ id: 'p-ana', memberId: 'ana' });
    withPhotos(anas, aPhoto({ id: 'p-mine' }));
    fake.whenSql('WHERE member_id = ? ORDER BY', [rowOf(anas)]);

    usePhotoStore.getState().removeMemberPhotos('ana');

    expect(fake.callMatching('DELETE FROM challenge_photos WHERE member_id = ?').params).toEqual(['ana']);
    expect(files.deleted[0]?.names).toEqual(['p-ana.jpg', 'p-ana.thumb.jpg']);
    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-mine']);
  });
});

describe('removeOrphans', () => {
  it('removes the photos of every challenge that is not open any more', () => {
    withPhotos(
      aPhoto({ id: 'p-open' }),
      aPhoto({ id: 'p-archived', challengeId: 'c-archived' }),
      aPhoto({ id: 'p-gone', challengeId: 'c-gone' }),
    );

    const removed = usePhotoStore.getState().removeOrphans(['c-read']);

    expect(removed).toBe(2);
    expect(usePhotoStore.getState().photos.map((p) => p.id)).toEqual(['p-open']);
    const deleted = fake.calls
      .filter((call) => call.sql === 'DELETE FROM challenge_photos WHERE challenge_id = ?')
      .map((call) => call.params?.[0]);
    expect(deleted).toEqual(['c-archived', 'c-gone']);
  });

  it('does nothing when every photo belongs to an open challenge', () => {
    withPhotos(aPhoto());

    expect(usePhotoStore.getState().removeOrphans(new Set(['c-read', 'c-walk']))).toBe(0);
    expect(fake.calls).toEqual([]);
  });
});

describe('clear', () => {
  it('empties the table, then the whole photos directory, the draft and the cache', () => {
    withPhotos(aPhoto());
    usePhotoDraftStore.setState({ draft: draft('p-draft') });

    usePhotoStore.getState().clear();

    expect(fake.calls.map((call) => call.sql)).toEqual(['DELETE FROM challenge_photos']);
    expect(files.wiped).toEqual([1]);
    expect(usePhotoStore.getState().photos).toEqual([]);
    expect(usePhotoDraftStore.getState().draft).toBeNull();
  });
});

describe('the draft', () => {
  it('holds one draft at a time: a new one deletes the files of the one it replaces', () => {
    usePhotoDraftStore.getState().setDraft(draft('p-first'));
    usePhotoDraftStore.getState().setDraft(draft('p-second'));

    expect(usePhotoDraftStore.getState().draft?.id).toBe('p-second');
    expect(files.deleted.map((entry) => entry.names)).toEqual([['p-first.jpg', 'p-first.thumb.jpg']]);
  });

  it('keeps the files when the same draft is set again', () => {
    usePhotoDraftStore.getState().setDraft(draft('p-first'));
    usePhotoDraftStore.getState().setDraft({ ...draft('p-first'), dayKey: '2026-09-21' });

    expect(files.deleted).toEqual([]);
  });

  it('deletes the files when discarded, and is a no-op without a draft', () => {
    usePhotoDraftStore.getState().discard();
    expect(files.deleted).toEqual([]);

    usePhotoDraftStore.getState().setDraft(draft('p-draft'));
    usePhotoDraftStore.getState().discard();

    expect(usePhotoDraftStore.getState().draft).toBeNull();
    expect(files.deleted.map((entry) => entry.names)).toEqual([['p-draft.jpg', 'p-draft.thumb.jpg']]);
  });

  it('never deletes the files of a draft that was saved', () => {
    withPhotos(aPhoto({ id: 'p-draft' }));
    usePhotoDraftStore.setState({ draft: draft('p-draft') });

    usePhotoDraftStore.getState().discard();
    usePhotoDraftStore.setState({ draft: draft('p-draft') });
    usePhotoDraftStore.getState().setDraft(draft('p-next'));

    expect(files.deleted).toEqual([]);
  });
});

describe('the files', () => {
  it('asks the platform for nothing when there were no photos to delete', () => {
    usePhotoStore.getState().removeChallengePhotos('c-empty');
    usePhotoStore.getState().removeMemberPhotos('ana');

    expect(files.deleted).toEqual([]);
  });
});
