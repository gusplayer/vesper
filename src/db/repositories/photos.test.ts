import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoredPhoto } from '../../domain/types';
import { CHALLENGE_PHOTOS_SQL } from '../migrations/011_challenge_photos';
import { SHARED_PHOTOS_SQL } from '../migrations/012_shared_photos';
import { createFakeDb, ddlColumns, insertColumns, transactionOn, type FakeRows } from '../testing/fakeDb';
import * as photos from './photos';

let fake = createFakeDb();

vi.mock('../client', () => ({
  getDb: () => fake,
  rowsAs: (result: { rows: FakeRows }) => result.rows,
  transaction: (work: () => void) => transactionOn(fake)(work),
}));

const T0 = 1_700_000_000_000;

const photo: StoredPhoto = {
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
  contentKey: null,
  remoteState: 'local',
  expiresAt: null,
  captionBox: null,
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
  content_key: null,
  remote_state: 'local',
  expires_at: null,
  caption_box: null,
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

  it('reads a row written before 012 as a local photo that never left', () => {
    const { content_key: _k, remote_state: _s, expires_at: _e, caption_box: _c, ...before012 } = photoRow;
    fake.whenSql('FROM challenge_photos', [before012]);

    expect(photos.listPhotos()[0]).toEqual(photo);
  });

  it('reads an unknown state as local, never as something to send', () => {
    fake.whenSql('FROM challenge_photos', [
      { ...photoRow, remote_state: 'sending', content_key: 'k', expires_at: 99, caption_box: '' },
    ]);

    expect(photos.listPhotos()[0]).toMatchObject({ remoteState: 'local', contentKey: 'k', expiresAt: 99, captionBox: null });
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
      null,
      'local',
      null,
      null,
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
    const declared = ddlColumns(`${CHALLENGE_PHOTOS_SQL}\n${SHARED_PHOTOS_SQL}`, table);
    expect(table).toBe('challenge_photos');
    expect(columns).toEqual(declared);
    expect(call.params).toHaveLength(columns.length);
  });
});

describe('where a photo stands with the server', () => {
  it('changes only the fields given, and when', () => {
    photos.updateShare('p-1', { remoteState: 'posted', expiresAt: 99 }, T0 + 5);
    photos.updateShare('p-1', {}, T0 + 6);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.sql).toBe('UPDATE challenge_photos SET remote_state = ?, expires_at = ?, updated_at = ? WHERE id = ?');
    expect(fake.calls[0]?.params).toEqual(['posted', 99, T0 + 5, 'p-1']);
  });

  it('writes every field of the share when asked to', () => {
    photos.updateShare('p-1', { contentKey: 'k', remoteState: 'queued', expiresAt: null, captionBox: 'b' }, T0);

    expect(fake.calls[0]?.sql).toBe(
      'UPDATE challenge_photos SET content_key = ?, remote_state = ?, expires_at = ?, caption_box = ?, updated_at = ? WHERE id = ?',
    );
    expect(fake.calls[0]?.params).toEqual(['k', 'queued', null, 'b', T0, 'p-1']);
  });

  it('records a downloaded file under its column', () => {
    photos.setPhotoFile('p-1', 'thumb', 'p-1.thumb.jpg');
    photos.setPhotoFile('p-1', 'full', 'p-1.jpg');

    expect(fake.calls.map((call) => [call.sql, call.params])).toEqual([
      ['UPDATE challenge_photos SET thumb_file = ? WHERE id = ?', ['p-1.thumb.jpg', 'p-1']],
      ['UPDATE challenge_photos SET full_file = ? WHERE id = ?', ['p-1.jpg', 'p-1']],
    ]);
  });

  it('writes and deletes a sync worth of rows in one transaction each, and nothing for none', () => {
    photos.replacePhotos([photo, { ...photo, id: 'p-2', dayKey: '2026-08-19' }]);
    photos.deletePhotos(['p-1', 'p-2']);
    photos.replacePhotos([]);
    photos.deletePhotos([]);

    expect(fake.calls.map((call) => call.sql.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'DELETE',
      'INSERT',
      'DELETE',
      'INSERT',
      'COMMIT',
      'BEGIN',
      'DELETE',
      'DELETE',
      'COMMIT',
    ]);
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

  it('012 adds what a shared photo needs, and every photo of tanda 1 stays local', () => {
    expect(ddlColumns(`${CHALLENGE_PHOTOS_SQL}\n${SHARED_PHOTOS_SQL}`, 'challenge_photos').slice(-4)).toEqual([
      'content_key',
      'remote_state',
      'expires_at',
      'caption_box',
    ]);
    expect(SHARED_PHOTOS_SQL).toContain("remote_state TEXT NOT NULL DEFAULT 'local'");
  });

  it('adds "Fotos del día" to challenges, on for every challenge that already exists', () => {
    expect(CHALLENGE_PHOTOS_SQL).toContain('ALTER TABLE challenges ADD COLUMN photos INTEGER NOT NULL DEFAULT 1');
  });
});
