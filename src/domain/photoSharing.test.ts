import { describe, expect, it } from 'vitest';

import {
  expiredPhotos,
  mergeRemotePhotos,
  photoAudience,
  photoVisible,
  thumbsToFetch,
  uploadCandidates,
  uploadPending,
  visiblePhotos,
  type RemotePhoto,
} from './photoSharing';
import { ME, type Challenge, type Member, type StoredPhoto } from './types';

const T0 = 1_700_000_000_000;

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c-read',
    name: 'Leer',
    weeklyTarget: 4,
    startWeekKey: '2026-09-21',
    endDayKey: '2026-10-11',
    createdBy: ME,
    participantIds: [ME, 'ana', 'luis', 'sofia'],
    habitId: 'habit-read',
    photos: true,
    createdAt: 0,
    archivedAt: null,
    ...overrides,
  };
}

function member(id: string, status: Member['status'] = 'member'): Member {
  return { id, name: id[0]?.toUpperCase() + id.slice(1), handle: id, status, joinedAt: 1, createdAt: 1 };
}

function photo(overrides: Partial<StoredPhoto> = {}): StoredPhoto {
  const id = overrides.id ?? 'p-1';
  return {
    id,
    challengeId: 'c-read',
    memberId: ME,
    dayKey: '2026-09-22',
    origin: 'camera',
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

function remote(overrides: Partial<RemotePhoto> = {}): RemotePhoto {
  return {
    id: 'p-ana',
    challengeId: 'c-read',
    memberId: 'ana',
    dayKey: '2026-09-22',
    origin: 'library',
    width: 1280,
    height: 960,
    captionBox: 'box',
    contentKey: 'k-ana',
    caption: 'Pierna,\npor fin.',
    createdAt: T0,
    updatedAt: T0,
    expiresAt: T0 + 100,
    deletedAt: null,
    ...overrides,
  };
}

describe('photoAudience', () => {
  const members = [member('ana'), member('luis'), member('sofia', 'pending')];

  it('is the other participants in the circle with a published key, in the challenge order', () => {
    const audience = photoAudience({
      challenge: challenge(),
      members,
      keyHolders: new Set(['luis', 'ana', 'sofia']),
      sharing: true,
    });

    expect(audience.map((m) => m.id)).toEqual(['ana', 'luis']);
  });

  it('is nobody without a key, without an account, with photos off, or once archived', () => {
    const base = { challenge: challenge(), members, keyHolders: new Set(['ana']), sharing: true };

    expect(photoAudience({ ...base, keyHolders: new Set() })).toEqual([]);
    expect(photoAudience({ ...base, sharing: false })).toEqual([]);
    expect(photoAudience({ ...base, challenge: challenge({ photos: false }) })).toEqual([]);
    expect(photoAudience({ ...base, challenge: challenge({ archivedAt: 5 }) })).toEqual([]);
  });

  it('never counts the user, even with a key under ME', () => {
    expect(photoAudience({ challenge: challenge(), members, keyHolders: new Set([ME]), sharing: true })).toEqual([]);
  });
});

describe('what is drawn', () => {
  const visibility = { hidden: new Set(['luis']), now: T0 };

  it("always draws the user's own, shared or not", () => {
    expect(photoVisible(photo(), visibility)).toBe(true);
    expect(photoVisible(photo({ remoteState: 'uploaded', expiresAt: T0 - 1 }), visibility)).toBe(true);
  });

  it('does not draw a hidden person, a photo without a key, or one past its date', () => {
    const anas = photo({ memberId: 'ana', remoteState: 'remote', contentKey: 'k', expiresAt: T0 + 1 });

    expect(photoVisible(anas, visibility)).toBe(true);
    expect(photoVisible({ ...anas, memberId: 'luis' }, visibility)).toBe(false);
    expect(photoVisible({ ...anas, contentKey: null }, visibility)).toBe(false);
    expect(photoVisible({ ...anas, expiresAt: T0 }, visibility)).toBe(false);
    expect(photoVisible({ ...anas, expiresAt: null }, visibility)).toBe(true);
    // Without a clock, the time is not judged here: the store deletes what expired.
    expect(photoVisible({ ...anas, expiresAt: T0 }, { hidden: new Set(), now: null })).toBe(true);
  });

  it('filters a list, and names the expired ones of other people only', () => {
    const photos = [
      photo({ id: 'mine', expiresAt: T0 - 1, remoteState: 'uploaded' }),
      photo({ id: 'old', memberId: 'ana', contentKey: 'k', expiresAt: T0 - 1, remoteState: 'remote' }),
      photo({ id: 'hidden', memberId: 'luis', contentKey: 'k', remoteState: 'remote' }),
    ];

    expect(visiblePhotos(photos, visibility).map((p) => p.id)).toEqual(['mine']);
    expect(expiredPhotos(photos, T0).map((p) => p.id)).toEqual(['old']);
  });
});

describe('the queue', () => {
  it('sends the user photos waiting to go up, oldest first, that still have their files', () => {
    const photos = [
      photo({ id: 'later', remoteState: 'queued', createdAt: T0 + 2 }),
      photo({ id: 'posted', remoteState: 'posted', createdAt: T0 + 1 }),
      photo({ id: 'local', remoteState: 'local' }),
      photo({ id: 'restored', remoteState: 'queued', fullFile: null }),
      photo({ id: 'theirs', memberId: 'ana', remoteState: 'queued' }),
      photo({ id: 'done', remoteState: 'uploaded' }),
    ];

    expect(uploadCandidates(photos).map((p) => p.id)).toEqual(['posted', 'later']);
    expect(uploadPending(photos[0] as StoredPhoto)).toBe(true);
    expect(uploadPending(photos[4] as StoredPhoto)).toBe(false);
  });

  it('fetches the thumbnails of a challenge that are drawn, openable and not here yet', () => {
    const photos = [
      photo({ id: 'ana', memberId: 'ana', remoteState: 'remote', contentKey: 'k', thumbFile: null }),
      photo({ id: 'here', memberId: 'ana', remoteState: 'remote', contentKey: 'k', dayKey: '2026-09-21' }),
      photo({ id: 'nokey', memberId: 'sofia', remoteState: 'remote', thumbFile: null }),
      photo({ id: 'hidden', memberId: 'luis', remoteState: 'remote', contentKey: 'k', thumbFile: null }),
      photo({ id: 'restored', remoteState: 'uploaded', contentKey: 'k', thumbFile: null, fullFile: null }),
      photo({ id: 'other', challengeId: 'c-walk', memberId: 'ana', remoteState: 'remote', contentKey: 'k', thumbFile: null }),
    ];

    const wanted = thumbsToFetch(photos, 'c-read', { hidden: new Set(['luis']), now: T0 });

    expect(wanted.map((p) => p.id)).toEqual(['ana', 'restored']);
  });
});

describe('mergeRemotePhotos', () => {
  it("writes somebody else's new photo with its key and its caption cleaned, and no files yet", () => {
    const plan = mergeRemotePhotos([], [remote()]);

    expect(plan.remove).toEqual([]);
    expect(plan.write).toEqual([
      {
        id: 'p-ana',
        challengeId: 'c-read',
        memberId: 'ana',
        dayKey: '2026-09-22',
        origin: 'library',
        caption: 'Pierna, por fin.',
        width: 1280,
        height: 960,
        fullFile: null,
        thumbFile: null,
        takenAt: T0,
        createdAt: T0,
        updatedAt: T0,
        contentKey: 'k-ana',
        remoteState: 'remote',
        expiresAt: T0 + 100,
        captionBox: 'box',
      },
    ]);
  });

  it('keeps the files and the key this phone already had of a photo', () => {
    const had = photo({ id: 'p-ana', memberId: 'ana', remoteState: 'remote', contentKey: 'k-old', fullFile: null });

    const plan = mergeRemotePhotos([had], [remote({ contentKey: null, updatedAt: T0 + 5, expiresAt: T0 + 200 })]);

    expect(plan.write[0]).toMatchObject({
      thumbFile: 'p-ana.thumb.jpg',
      contentKey: 'k-old',
      expiresAt: T0 + 200,
      updatedAt: T0 + 5,
    });
  });

  it("deletes somebody else's photo on its tombstone, and ignores one it never had", () => {
    const had = photo({ id: 'p-ana', memberId: 'ana', remoteState: 'remote', contentKey: 'k' });

    const plan = mergeRemotePhotos([had], [remote({ deletedAt: T0 + 1 }), remote({ id: 'p-never', deletedAt: T0 })]);

    expect(plan.write).toEqual([]);
    expect(plan.remove.map((p) => p.id)).toEqual(['p-ana']);
  });

  it("keeps the user's own photo on a tombstone, local from then on, until the archive", () => {
    const mine = photo({ remoteState: 'uploaded', contentKey: 'k', expiresAt: T0 });
    const restored = photo({ id: 'p-restored', remoteState: 'uploaded', contentKey: 'k', fullFile: null, thumbFile: null });
    const half = photo({ id: 'p-half', remoteState: 'posted', contentKey: 'k', dayKey: '2026-09-21' });

    const plan = mergeRemotePhotos(
      [mine, restored, half],
      [
        remote({ id: 'p-1', memberId: ME, deletedAt: T0 }),
        remote({ id: 'p-restored', memberId: ME, deletedAt: T0 }),
        remote({ id: 'p-half', memberId: ME, deletedAt: T0 }),
      ],
    );

    expect(plan.write.map((p) => [p.id, p.remoteState, p.expiresAt])).toEqual([
      ['p-1', 'local', null],
      ['p-half', 'queued', null],
    ]);
    expect(plan.remove.map((p) => p.id)).toEqual(['p-restored']);
  });

  it("marks the user's own photo uploaded when the server has it whole", () => {
    const posted = photo({ remoteState: 'posted', contentKey: 'k' });

    const plan = mergeRemotePhotos([posted], [remote({ id: 'p-1', memberId: ME, expiresAt: T0 + 9, contentKey: 'other' })]);

    expect(plan.write[0]).toMatchObject({ id: 'p-1', remoteState: 'uploaded', expiresAt: T0 + 9, contentKey: 'k', fullFile: 'p-1.jpg' });
  });

  it("brings back the user's own photos after a restore, without files, when their key opened", () => {
    const plan = mergeRemotePhotos(
      [],
      [remote({ id: 'p-mine', memberId: ME }), remote({ id: 'p-shut', memberId: ME, contentKey: null, dayKey: '2026-09-21' })],
    );

    expect(plan.write.map((p) => [p.id, p.remoteState, p.fullFile])).toEqual([['p-mine', 'uploaded', null]]);
  });

  it("leaves the server's photo of a day the user already has another one for here", () => {
    const here = photo({ id: 'p-here', remoteState: 'queued' });

    const plan = mergeRemotePhotos([here], [remote({ id: 'p-server', memberId: ME })]);

    expect(plan).toEqual({ write: [], remove: [] });
  });

  it('replaces an older photo of the same person and day, and drops an older one arriving late', () => {
    const older = photo({ id: 'p-older', memberId: 'ana', remoteState: 'remote', contentKey: 'k', createdAt: T0 - 10 });

    const newer = mergeRemotePhotos([older], [remote({ id: 'p-newer', createdAt: T0 })]);
    expect(newer.write.map((p) => p.id)).toEqual(['p-newer']);
    expect(newer.remove.map((p) => p.id)).toEqual(['p-older']);

    const late = mergeRemotePhotos([photo({ ...older, createdAt: T0 + 10 })], [remote({ id: 'p-newer', createdAt: T0 })]);
    expect(late).toEqual({ write: [], remove: [] });
  });

  it('applies the changes oldest first, so a tombstone after a write wins', () => {
    const plan = mergeRemotePhotos(
      [],
      [remote({ deletedAt: T0 + 2, updatedAt: T0 + 2 }), remote({ updatedAt: T0 + 1 })],
    );

    expect(plan.write).toEqual([]);
  });

  it('removes and never writes a photo the user reported', () => {
    const had = photo({ id: 'p-ana', memberId: 'ana', remoteState: 'remote', contentKey: 'k' });

    const plan = mergeRemotePhotos([had], [remote()], new Set(['p-ana']));

    expect(plan.write).toEqual([]);
    expect(plan.remove.map((p) => p.id)).toEqual(['p-ana']);
  });
});
