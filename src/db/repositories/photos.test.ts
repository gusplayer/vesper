import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChallengePhoto } from '../../domain/types';
import { CHALLENGE_PHOTOS_SQL } from '../migrations/011_challenge_photos';
import { createFakeDb, ddlColumns, insertColumns, transactionOn, type FakeRows } from '../testing/fakeDb';
import * as photos from './photos';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

const T0 = 1_700_000_000_000;

const photo: ChallengePhoto = {
  id: 'p-1',
  challengeId: 'challenge-read',
  memberId: 'me',
  dayKey: '2026-08-18',
  origin: 'camera',
  caption: 'Pierna, por fin.',
  width: 1280,
  height: 960,
  fullFile: 'p-1.jpg',
  thumbFile: 'p-1.thumb.jpg',
  takenAt: T0,
  createdAt: T0,
  updatedAt: T0 + 1,
};

const photoRow = {
  id: 'p-1',
  challenge_id: 'challenge-read',
  member_id: 'me',
  day_key: '2026-08-18',
  origin: 'camera',
  caption: 'Pierna, por fin.',
  width: 1280,
  height: 960,
  full_file: 'p-1.jpg',
  thumb_file: 'p-1.thumb.jpg',
  taken_at: T0,
  created_at: T0,
  updated_at: T0 + 1,
};

beforeEach(() => {
  fake = createFakeDb();
});

describe('reading', () => {
  it('maps every row to camelCase, the whole table by challenge and day', () => {
    fake.whenSql('FROM challenge_photos', [photoRow, { ...photoRow, id: 'p-2', member_id: 'ana', origin: 'library' }]);

    const listed = photos.listPhotos();

    expect(listed[0]).toEqual(photo);
    expect(listed[1]).toMatchObject({ id: 'p-2', memberId: 'ana', origin: 'library' });
    expect(fake.callMatching('FROM challenge_photos').sql).toContain('ORDER BY challenge_id, day_key, member_id');
  });

  it('reads an unknown origin as the library, never as the camera', () => {
    fake.whenSql('FROM challenge_photos', [{ ...photoRow, origin: 'screenshot' }]);

    expect(photos.listPhotos()[0]?.origin).toBe('library');
  });

  it('reads a missing caption or file name as null', () => {
    fake.whenSql('FROM challenge_photos', [
      { ...photoRow, caption: null, full_file: null, thumb_file: null },
      { ...photoRow, id: 'p-2', caption: '', full_file: '', thumb_file: '' },
    ]);

    for (const read of photos.listPhotos()) {
      expect(read).toMatchObject({ caption: null, fullFile: null, thumbFile: null });
    }
  });

  it('lists one challenge, or one person, by the column that says so', () => {
    photos.listChallengePhotos('challenge-read');
    photos.listMemberPhotos('ana');

    expect(fake.callMatching('WHERE challenge_id = ?').params).toEqual(['challenge-read']);
    expect(fake.callMatching('WHERE member_id = ?').params).toEqual(['ana']);
  });

  it('finds the photo of a day, or null', () => {
    expect(photos.findPhotoAt('challenge-read', 'me', '2026-08-18')).toBeNull();
    expect(fake.callMatching('LIMIT 1').params).toEqual(['challenge-read', 'me', '2026-08-18']);

    fake.whenSql('LIMIT 1', [photoRow]);
    expect(photos.findPhotoAt('challenge-read', 'me', '2026-08-18')).toEqual(photo);
  });

  it('finds a photo by id, or null', () => {
    expect(photos.findPhoto('p-1')).toBeNull();
    expect(fake.callMatching('WHERE id = ? LIMIT 1').params).toEqual(['p-1']);

    fake.whenSql('WHERE id = ? LIMIT 1', [photoRow]);
    expect(photos.findPhoto('p-1')).toEqual(photo);
  });
});

describe('replacePhoto', () => {
  it('deletes whatever held that day or that id, then inserts, in one transaction', () => {
    photos.replacePhoto(photo);

    const verbs = fake.calls.map((call) => call.sql.trim().split(/\s+/)[0]);
    expect(verbs).toEqual(['BEGIN', 'DELETE', 'INSERT', 'COMMIT']);
    expect(fake.calls[1]?.sql).toContain('id = ? OR (challenge_id = ? AND member_id = ? AND day_key = ?)');
    expect(fake.calls[1]?.params).toEqual(['p-1', 'challenge-read', 'me', '2026-08-18']);
    expect(fake.calls[2]?.params).toEqual([
      'p-1',
      'challenge-read',
      'me',
      '2026-08-18',
      'camera',
      'Pierna, por fin.',
      1280,
      960,
      'p-1.jpg',
      'p-1.thumb.jpg',
      T0,
      T0,
      T0 + 1,
    ]);
  });

  it('rolls back when the insert fails, so a day never loses its photo for nothing', () => {
    const failing = createFakeDb();
    const original = failing.executeSync;
    failing.executeSync = (sql, params) => {
      if (sql.includes('INSERT')) {
        throw new Error('disk full');
      }
      return original(sql, params);
    };
    fake = failing;

    expect(() => photos.replacePhoto(photo)).toThrow('disk full');
    expect(fake.calls.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('only inserts columns the migration declares', () => {
    photos.replacePhoto(photo);

    const call = fake.callMatching(/INSERT INTO challenge_photos/);
    const { table, columns } = insertColumns(call.sql);
    const declared = ddlColumns(CHALLENGE_PHOTOS_SQL, table);
    expect(table).toBe('challenge_photos');
    expect(columns).toEqual(declared);
    expect(call.params).toHaveLength(columns.length);
  });
});

describe('deleting', () => {
  it('deletes by id, by challenge, by person, and everything', () => {
    photos.deletePhoto('p-1');
    photos.deleteChallengePhotos('challenge-read');
    photos.deleteMemberPhotos('ana');
    photos.deleteAllPhotos();

    expect(fake.calls.map((call) => [call.sql, call.params])).toEqual([
      ['DELETE FROM challenge_photos WHERE id = ?', ['p-1']],
      ['DELETE FROM challenge_photos WHERE challenge_id = ?', ['challenge-read']],
      ['DELETE FROM challenge_photos WHERE member_id = ?', ['ana']],
      ['DELETE FROM challenge_photos', undefined],
    ]);
  });
});

describe('the migration', () => {
  it('declares every column of a ChallengePhoto and the one-per-day rule', () => {
    expect(ddlColumns(CHALLENGE_PHOTOS_SQL, 'challenge_photos')).toEqual([
      'id',
      'challenge_id',
      'member_id',
      'day_key',
      'origin',
      'caption',
      'width',
      'height',
      'full_file',
      'thumb_file',
      'taken_at',
      'created_at',
      'updated_at',
    ]);
    expect(CHALLENGE_PHOTOS_SQL).toContain('UNIQUE(challenge_id, member_id, day_key)');
  });

  it('adds "Fotos del día" to challenges, on for every challenge that already exists', () => {
    expect(CHALLENGE_PHOTOS_SQL).toContain('ALTER TABLE challenges ADD COLUMN photos INTEGER NOT NULL DEFAULT 1');
  });
});
