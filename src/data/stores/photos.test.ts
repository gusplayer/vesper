import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeDb, transactionOn, type FakeRows } from '../../db/testing/fakeDb';
import type { RemotePhoto } from '../../domain/photoSharing';
import { ME, type StoredPhoto } from '../../domain/types';
import {
  cleanReportNote,
  PHOTO_KEYS,
  readBoxKeys,
  readPendingReports,
  usePhotoDraftStore,
  usePhotoStore,
  usePhotoTransferStore,
  type PhotoDraft,
} from './photos';

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

function rowOf(photo: StoredPhoto) {
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
    content_key: photo.contentKey,
    remote_state: photo.remoteState,
    expires_at: photo.expiresAt,
    caption_box: photo.captionBox,
  };
}

function aPhoto(overrides: Partial<StoredPhoto> = {}): StoredPhoto {
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
    contentKey: null,
    remoteState: 'local',
    expiresAt: null,
    captionBox: null,
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
function withPhotos(...photos: StoredPhoto[]): void {
  fake = createFakeDb();
  fake.whenSql('ORDER BY challenge_id, day_key, member_id', photos.map(rowOf));
  usePhotoStore.getState().hydrate();
  fake.calls.length = 0;
}

beforeEach(() => {
  fake = createFakeDb();
  files.deleted.length = 0;
  files.wiped.length = 0;
  usePhotoStore.setState({
    photos: [],
    hiddenMembers: [],
    boxKeys: {},
    pendingDeletes: [],
    pendingReports: [],
    reported: [],
    termsAcceptedAt: null,
  });
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
      contentKey: null,
      remoteState: 'local',
      expiresAt: null,
      captionBox: null,
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

// --- Shared (tanda 2) ----------------------------------------------------------------------

const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';

/** The circle as the database has it: a challenge, its people, and whether there is an account. */
function circleDb(options: { photos?: boolean; account?: boolean; anaStatus?: string } = {}): void {
  fake.whenSql('FROM challenges', [
    {
      id: 'c-read',
      name: 'Leer',
      weekly_target: 4,
      start_week_key: '2026-09-21',
      end_week_key: '2026-10-05',
      end_day_key: '2026-10-11',
      created_by: ME,
      participant_ids: JSON.stringify([ME, ANA]),
      habit_id: 'habit-read',
      photos: options.photos === false ? 0 : 1,
      created_at: 1,
      archived_at: null,
    },
  ]);
  fake.whenSql('FROM circle_members', [
    { id: ANA, name: 'Ana', handle: 'ana', status: options.anaStatus ?? 'member', joined_at: 1, created_at: 1 },
  ]);
  if (options.account !== false) {
    fake.whenSql('SELECT value FROM settings', [{ value: JSON.stringify({ id: 'acc', createdAt: 1 }) }]);
  }
}

const ANA_KEY = { boxKey: 'a2V5', keyId: '0123456789abcdef' };

function save(id = 'p-new') {
  return usePhotoStore.getState().savePhoto(
    { challengeId: 'c-read', dayKey: '2026-09-22', prepared: prepared(id), origin: 'camera', caption: null, id },
    T0,
  );
}

function remote(overrides: Partial<RemotePhoto> = {}): RemotePhoto {
  return {
    id: 'p-ana',
    challengeId: 'c-read',
    memberId: ANA,
    dayKey: '2026-09-22',
    origin: 'camera',
    width: 1280,
    height: 960,
    captionBox: null,
    contentKey: 'k-ana',
    caption: null,
    createdAt: T0,
    updatedAt: T0,
    expiresAt: T0 + 1_000_000,
    deletedAt: null,
    ...overrides,
  };
}

function settingWrites(key: string): unknown[] {
  return fake.calls
    .filter((call) => call.sql.startsWith('INSERT INTO settings') && call.params?.[0] === key)
    .map((call) => JSON.parse(String(call.params?.[1])) as unknown);
}

describe('savePhoto, shared (ADR-0051 tanda 2)', () => {
  it('queues the photo when somebody else in the challenge has a key', () => {
    circleDb();
    usePhotoStore.setState({ boxKeys: { [ANA]: ANA_KEY } });

    expect(save().remoteState).toBe('queued');
    expect(fake.callMatching(/INSERT INTO challenge_photos/).params).toContain('queued');
  });

  it('keeps it local without a circle account, with photos off, or with nobody to see it', () => {
    circleDb({ account: false });
    usePhotoStore.setState({ boxKeys: { [ANA]: ANA_KEY } });
    expect(save('p-1').remoteState).toBe('local');

    fake = createFakeDb();
    circleDb({ photos: false });
    expect(save('p-2').remoteState).toBe('local');

    fake = createFakeDb();
    circleDb();
    usePhotoStore.setState({ boxKeys: {} });
    expect(save('p-3').remoteState).toBe('local');

    fake = createFakeDb();
    circleDb({ anaStatus: 'pending' });
    usePhotoStore.setState({ boxKeys: { [ANA]: ANA_KEY } });
    expect(save('p-4').remoteState).toBe('local');
  });

  it('owes the server a delete for the photo it replaces, once that one went up', () => {
    const old = aPhoto({ remoteState: 'uploaded', contentKey: 'k-old' });
    withPhotos(old);
    fake.whenSql('LIMIT 1', [rowOf(old)]);

    save();

    expect(usePhotoStore.getState().pendingDeletes).toEqual(['p-old']);
    expect(settingWrites(PHOTO_KEYS.pendingDeletes)).toEqual([['p-old']]);
  });

  it('owes nothing for a replaced photo that never left', () => {
    const old = aPhoto();
    withPhotos(old);
    fake.whenSql('LIMIT 1', [rowOf(old)]);

    save();

    expect(usePhotoStore.getState().pendingDeletes).toEqual([]);
  });

  it('keeps where the same photo stands when it is saved again', () => {
    const same = aPhoto({ id: 'p-new', remoteState: 'uploaded', contentKey: 'k', expiresAt: 9, captionBox: 'b' });
    withPhotos(same);
    fake.whenSql('LIMIT 1', [rowOf(same)]);

    expect(save()).toMatchObject({ remoteState: 'uploaded', contentKey: 'k', expiresAt: 9, captionBox: 'b' });
    expect(usePhotoStore.getState().pendingDeletes).toEqual([]);
  });
});

describe('removePhoto, shared', () => {
  it('queues the delete of a photo that reached the server, or may have', () => {
    for (const [state, key, owed] of [
      ['uploaded', 'k', true],
      ['posted', 'k', true],
      ['queued', 'k', true],
      ['queued', null, false],
      ['local', null, false],
    ] as const) {
      const photo = aPhoto({ id: `p-${state}-${String(key)}`, remoteState: state, contentKey: key });
      withPhotos(photo);
      fake.whenSql('WHERE id = ? LIMIT 1', [rowOf(photo)]);
      usePhotoStore.setState({ pendingDeletes: [] });

      usePhotoStore.getState().removePhoto(photo.id, T0);

      expect(usePhotoStore.getState().pendingDeletes).toEqual(owed ? [photo.id] : []);
    }
  });

  it('forgets a delete once the server has it', () => {
    usePhotoStore.setState({ pendingDeletes: ['p-1', 'p-2'] });

    usePhotoStore.getState().settleDelete('p-1', T0);

    expect(usePhotoStore.getState().pendingDeletes).toEqual(['p-2']);
    expect(settingWrites(PHOTO_KEYS.pendingDeletes)).toEqual([['p-2']]);
  });
});

describe('applyRemote', () => {
  it("writes other people's photos, with the key this phone opened", () => {
    usePhotoStore.getState().applyRemote([remote()], T0);

    const [written] = usePhotoStore.getState().photos;
    expect(written).toMatchObject({ id: 'p-ana', memberId: ANA, contentKey: 'k-ana', remoteState: 'remote', thumbFile: null });
    expect(fake.callMatching(/INSERT INTO challenge_photos/).params?.[0]).toBe('p-ana');
  });

  it('deletes the row and then the files of a tombstone', () => {
    const anas = aPhoto({ id: 'p-ana', memberId: ANA, remoteState: 'remote', contentKey: 'k', thumbFile: 'p-ana.thumb.jpg', fullFile: null });
    withPhotos(anas);

    usePhotoStore.getState().applyRemote([remote({ deletedAt: T0 + 1, updatedAt: T0 + 1 })], T0 + 1);

    expect(usePhotoStore.getState().photos).toEqual([]);
    const deleteRow = fake.calls.findIndex((call) => call.sql === 'DELETE FROM challenge_photos WHERE id = ?');
    expect(deleteRow).toBeGreaterThanOrEqual(0);
    expect(files.deleted).toEqual([{ names: [null, 'p-ana.thumb.jpg'], afterCalls: fake.calls.length }]);
  });

  it('never lets a reported photo back in', () => {
    usePhotoStore.setState({ reported: ['p-ana'] });

    usePhotoStore.getState().applyRemote([remote()], T0);

    expect(usePhotoStore.getState().photos).toEqual([]);
  });

  it("lets other people's expired photos go, and keeps the user's", () => {
    withPhotos(
      aPhoto({ id: 'p-gone', memberId: ANA, remoteState: 'remote', contentKey: 'k', expiresAt: T0 }),
      aPhoto({ id: 'p-mine', remoteState: 'uploaded', contentKey: 'k', expiresAt: T0, dayKey: '2026-09-21' }),
    );

    usePhotoStore.getState().applyRemote([], T0 + 1);

    expect(usePhotoStore.getState().photos.map((photo) => photo.id)).toEqual(['p-mine']);
  });
});

describe('setShare and setFile', () => {
  it('records a step of an upload on the row and in the cache', () => {
    withPhotos(aPhoto({ remoteState: 'queued' }));

    usePhotoStore.getState().setShare('p-old', { remoteState: 'posted', expiresAt: 99 }, T0 + 3);

    expect(fake.callMatching('UPDATE challenge_photos SET').params).toEqual(['posted', 99, T0 + 3, 'p-old']);
    expect(usePhotoStore.getState().photos[0]).toMatchObject({ remoteState: 'posted', expiresAt: 99, updatedAt: T0 + 3 });
  });

  it('does nothing for a photo that is gone', () => {
    usePhotoStore.getState().setShare('p-nowhere', { remoteState: 'posted' }, T0);

    expect(fake.calls).toEqual([]);
  });

  it('names a downloaded file on its row, and deletes the file when the row went meanwhile', () => {
    withPhotos(aPhoto({ id: 'p-ana', memberId: ANA, thumbFile: null, remoteState: 'remote', contentKey: 'k' }));

    usePhotoStore.getState().setFile('p-ana', 'thumb', 'p-ana.thumb.jpg');
    usePhotoStore.getState().setFile('p-gone', 'full', 'p-gone.jpg');

    expect(usePhotoStore.getState().photos[0]?.thumbFile).toBe('p-ana.thumb.jpg');
    expect(fake.callMatching('SET thumb_file').params).toEqual(['p-ana.thumb.jpg', 'p-ana']);
    expect(files.deleted.map((entry) => entry.names)).toEqual([['p-gone.jpg']]);
  });
});

describe('the keys of the circle', () => {
  it('replaces them with what a sync says, and writes nothing when nothing changed', () => {
    usePhotoStore.getState().setBoxKeys([{ id: ANA, ...ANA_KEY }], T0);
    usePhotoStore.getState().setBoxKeys([{ id: ANA, ...ANA_KEY }], T0 + 1);

    expect(usePhotoStore.getState().boxKeys).toEqual({ [ANA]: ANA_KEY });
    expect(settingWrites(PHOTO_KEYS.boxKeys)).toEqual([{ [ANA]: ANA_KEY }]);
  });

  it('merges the keys a 409 names over the ones kept', () => {
    usePhotoStore.setState({ boxKeys: { [ANA]: ANA_KEY, luis: { boxKey: 'b', keyId: '1111111111111111' } } });

    usePhotoStore.getState().mergeBoxKeys([{ id: ANA, boxKey: 'bmV3', keyId: 'fedcba9876543210' }], T0);

    expect(usePhotoStore.getState().boxKeys).toEqual({
      [ANA]: { boxKey: 'bmV3', keyId: 'fedcba9876543210' },
      luis: { boxKey: 'b', keyId: '1111111111111111' },
    });
  });

  it('reads a stored list defensively', () => {
    expect(readBoxKeys({ [ANA]: ANA_KEY, bad: { boxKey: 1 }, empty: { boxKey: '', keyId: '' } })).toEqual({ [ANA]: ANA_KEY });
    expect(readBoxKeys(['nope'])).toEqual({});
    expect(readBoxKeys(null)).toEqual({});
  });
});

describe('reportPhoto', () => {
  it('takes the photo off this phone, keeps it out, and queues the report with its key', () => {
    const anas = aPhoto({ id: 'p-ana', memberId: ANA, remoteState: 'remote', contentKey: 'k-ana' });
    withPhotos(anas);

    const report = usePhotoStore.getState().reportPhoto('p-ana', 'consent', '  no\nme pidió  ', T0);

    expect(report).toEqual({ mediaId: 'p-ana', reason: 'consent', note: 'no me pidió', contentKey: 'k-ana' });
    expect(usePhotoStore.getState().photos).toEqual([]);
    expect(usePhotoStore.getState().reported).toEqual(['p-ana']);
    expect(settingWrites(PHOTO_KEYS.pendingReports)).toEqual([[report]]);
    expect(files.deleted).toHaveLength(1);
  });

  it("reports nothing of the user's own, or of a photo with no key", () => {
    withPhotos(aPhoto({ id: 'p-mine' }), aPhoto({ id: 'p-ana', memberId: ANA, dayKey: '2026-09-21' }));

    expect(usePhotoStore.getState().reportPhoto('p-mine', 'other', null, T0)).toBeNull();
    expect(usePhotoStore.getState().reportPhoto('p-ana', 'other', null, T0)).toBeNull();
    expect(usePhotoStore.getState().photos).toHaveLength(2);
  });

  it('forgets a report once the server has it', () => {
    usePhotoStore.setState({ pendingReports: [{ mediaId: 'p-ana', reason: 'minor', note: null, contentKey: 'k' }] });

    usePhotoStore.getState().settleReport('p-ana', T0);

    expect(usePhotoStore.getState().pendingReports).toEqual([]);
  });

  it('reads stored reports defensively, and cleans a note', () => {
    expect(
      readPendingReports([
        { mediaId: 'p', reason: 'minor', note: '', contentKey: 'k' },
        { mediaId: 'q', reason: 'spam', contentKey: 'k' },
        { mediaId: 'r', reason: 'other' },
      ]),
    ).toEqual([{ mediaId: 'p', reason: 'minor', note: null, contentKey: 'k' }]);
    expect(cleanReportNote(' '.repeat(3))).toBeNull();
    expect(cleanReportNote('a'.repeat(250))).toHaveLength(200);
  });
});

describe('hiding a person, and the terms', () => {
  it('hides and shows a person, deleting nothing', () => {
    withPhotos(aPhoto({ id: 'p-ana', memberId: ANA, remoteState: 'remote', contentKey: 'k' }));

    usePhotoStore.getState().hideMember(ANA, T0);
    usePhotoStore.getState().hideMember(ANA, T0);
    usePhotoStore.getState().hideMember(ME, T0);

    expect(usePhotoStore.getState().hiddenMembers).toEqual([ANA]);
    expect(usePhotoStore.getState().photos).toHaveLength(1);
    expect(files.deleted).toEqual([]);

    usePhotoStore.getState().showMember(ANA, T0);
    expect(usePhotoStore.getState().hiddenMembers).toEqual([]);
    expect(settingWrites(PHOTO_KEYS.hiddenMembers)).toEqual([[ANA], []]);
  });

  it('keeps when the terms were accepted', () => {
    usePhotoStore.getState().acceptTerms(T0);

    expect(usePhotoStore.getState().termsAcceptedAt).toBe(T0);
    expect(settingWrites(PHOTO_KEYS.termsAcceptedAt)).toEqual([T0]);
  });

  it('reads every list back at hydrate', () => {
    fake = createFakeDb();
    fake.whenSql('SELECT value FROM settings', [{ value: JSON.stringify([ANA]) }]);

    usePhotoStore.getState().hydrate();

    // Every key answers the same row here: each reader keeps only what fits its shape.
    const state = usePhotoStore.getState();
    expect(state.hiddenMembers).toEqual([ANA]);
    expect(state.pendingDeletes).toEqual([ANA]);
    expect(state.boxKeys).toEqual({});
    expect(state.pendingReports).toEqual([]);
    expect(state.termsAcceptedAt).toBeNull();
  });
});

describe('leaving a challenge, and the account', () => {
  it("takes other people's photos of a challenge the user left, and keeps the user's", () => {
    const mine = aPhoto({ id: 'p-mine' });
    const anas = aPhoto({ id: 'p-ana', memberId: ANA, remoteState: 'remote', contentKey: 'k' });
    withPhotos(mine, anas);
    fake.whenSql('WHERE challenge_id = ? ORDER BY', [rowOf(mine), rowOf(anas)]);

    usePhotoStore.getState().removeOthersPhotos('c-read');

    expect(usePhotoStore.getState().photos.map((photo) => photo.id)).toEqual(['p-mine']);
    expect(files.deleted.map((entry) => entry.names)).toEqual([['p-ana.jpg', 'p-ana.thumb.jpg']]);
  });

  it('forgets the queues and the keys of an account that went', () => {
    usePhotoStore.setState({
      pendingDeletes: ['p'],
      pendingReports: [{ mediaId: 'q', reason: 'other', note: null, contentKey: 'k' }],
      boxKeys: { [ANA]: ANA_KEY },
      hiddenMembers: [ANA],
    });

    usePhotoStore.getState().forgetSharing(T0);

    const state = usePhotoStore.getState();
    expect([state.pendingDeletes, state.pendingReports, state.boxKeys]).toEqual([[], [], {}]);
    expect(state.hiddenMembers).toEqual([ANA]);
  });

  it('clears the downloads too on "Borrar todo"', () => {
    usePhotoTransferStore.setState({ running: { 'p:thumb': true }, failures: { 'q:full': 'offline' } });

    usePhotoStore.getState().clear();

    expect(usePhotoTransferStore.getState()).toMatchObject({ running: {}, failures: {} });
  });
});
