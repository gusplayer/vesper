import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The SQL of the photos (ADR-0051), against a pool that records what it is asked. The
 * rules run under photos.test.ts on the memory store (and were run once against a real
 * Postgres 17, see server/README.md); what is checked here is what only SQL can promise:
 * one photo a day replaced inside one transaction, an object marked in one statement, a
 * wrap found by containment, a ban nothing else writes.
 */

const calls: { text: string; values: unknown[] }[] = [];
let rows: Record<string, unknown>[] = [];
/** Errors to throw, in order, from the matching statements. */
let errors: { match: string; error: unknown }[] = [];

vi.mock('pg', () => {
  const run = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    const index = errors.findIndex((entry) => text.includes(entry.match));
    if (index !== -1) {
      const [entry] = errors.splice(index, 1);
      throw entry?.error;
    }
    return { rows };
  };
  class Pool {
    async query(text: string, values: unknown[] = []) {
      return run(text, values);
    }
    async connect() {
      return { query: run, release: () => calls.push({ text: 'release', values: [] }) };
    }
    async end() {}
  }
  return { default: { Pool } };
});

const { createPgStore } = await import('./pgStore.ts');

const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';
const CH1 = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const M1 = '0199a1b2-c3d4-7e5f-8a9b-0000000000e1';

const media = {
  id: M1,
  challengeId: CH1,
  ownerId: GUS,
  dayKey: '2026-09-23',
  width: 1280,
  height: 960,
  origin: 'camera' as const,
  epk: 'epk',
  captionBox: null,
  wraps: [{ recipientId: ANA, keyId: 'aaaaaaaaaaaaaaaa', box: 'box' }],
  thumbSize: 100,
  fullSize: 200,
  state: 'pending' as const,
  thumbAt: null,
  fullAt: null,
  createdAt: 1,
  updatedAt: 1,
  expiresAt: 9,
  deletedAt: null,
};

const firstWords = (text: string) => text.trim().split(/\s+/).slice(0, 3).join(' ');

beforeEach(() => {
  calls.length = 0;
  rows = [];
  errors = [];
});

describe('photos in Postgres', () => {
  it('tombstones the day’s photo and writes the new one inside one transaction', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.putMediaReplacing(media);

    expect(calls.map((call) => firstWords(call.text))).toEqual([
      'begin',
      'update media set',
      'insert into media',
      'commit',
      'release',
    ]);
    expect(calls[1]?.text).toMatch(/challenge_id = \$1 and owner_id = \$2 and day_key = \$3 and id <> \$4 and deleted_at is null/);
    expect(calls[1]?.values).toEqual([CH1, GUS, '2026-09-23', M1, 1]);
    // The wraps travel as JSON text, which Postgres reads into jsonb.
    expect(calls[2]?.values[9]).toBe(JSON.stringify(media.wraps));
  });

  it('tries once more when another upload took the day in the same instant', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    errors = [{ match: 'insert into media', error: { code: '23505', constraint: 'media_one_a_day' } }];

    await store.putMediaReplacing(media);

    expect(calls.filter((call) => call.text === 'rollback')).toHaveLength(1);
    expect(calls.filter((call) => call.text === 'commit')).toHaveLength(1);
  });

  it('marks an object and turns the row ready in one statement', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.markMediaObject(M1, 'full', 42);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toMatch(/set full_at = \$2/);
    expect(calls[0]?.text).toMatch(/when thumb_at is not null then 'ready'/);
    expect(calls[0]?.text).toMatch(/where id = \$1 and deleted_at is null/);
    expect(calls[0]?.values).toEqual([M1, 42]);
  });

  it('finds the photos wrapped for someone by containment, ready or tombstoned', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.mediaChangedFor(ANA, 10);

    expect(calls[0]?.text).toMatch(/wraps @> \$3::jsonb/);
    expect(calls[0]?.text).toMatch(/state = 'ready' or deleted_at is not null/);
    expect(calls[0]?.values).toEqual([ANA, 10, JSON.stringify([{ recipientId: ANA }])]);
  });

  it('reads a row back with its epochs as numbers and its wraps as objects', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    rows = [
      {
        id: M1,
        challenge_id: CH1,
        owner_id: GUS,
        day_key: '2026-09-23',
        width: 1280,
        height: 960,
        origin: 'library',
        epk: 'epk',
        caption_box: null,
        wraps: [{ recipientId: ANA, keyId: 'aaaaaaaaaaaaaaaa', box: 'box' }, { nonsense: true }],
        thumb_size: 100,
        full_size: 200,
        state: 'ready',
        thumb_at: '5',
        full_at: '6',
        created_at: '1',
        updated_at: '6',
        expires_at: '9',
        deleted_at: null,
      },
    ];

    expect(await store.getMedia(M1)).toEqual({
      ...media,
      origin: 'library',
      wraps: [{ recipientId: ANA, keyId: 'aaaaaaaaaaaaaaaa', box: 'box' }],
      state: 'ready',
      thumbAt: 5,
      fullAt: 6,
      updatedAt: 6,
    });
  });

  it('never writes a ban from putAccount, and bans once', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.putAccount({
      id: GUS,
      secretHash: 'x',
      name: 'Gus',
      handle: 'gus',
      inviteCode: null,
      pushToken: null,
      timeZone: null,
      nudgesOn: true,
      platform: null,
      appVersion: null,
      lastSeenAt: null,
      boxKey: 'key',
      boxKeyId: 'id',
      bannedAt: 123,
      createdAt: 1,
      updatedAt: 1,
    });
    await store.banAccount(GUS, 7);

    expect(calls[0]?.text).not.toMatch(/banned_at/);
    expect(calls[0]?.text).toMatch(/box_key = excluded\.box_key/);
    expect(calls[1]?.text).toMatch(/set banned_at = \$2 where id = \$1 and banned_at is null/);
  });

  it('answers false for a second report of the same photo by the same person', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    errors = [{ match: 'insert into reports', error: { code: '23505', constraint: 'reports_one_per_reporter' } }];

    const written = await store.putReport({
      id: 'r1',
      mediaId: M1,
      reporterId: ANA,
      ownerId: GUS,
      challengeId: CH1,
      dayKey: '2026-09-23',
      reason: 'other',
      note: null,
      contentKey: 'k',
      createdAt: 1,
      resolvedAt: null,
      action: null,
      preservedUntil: null,
    });

    expect(written).toBe(false);
  });

  it('keeps a block once, and reads it from either side', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.putBlock(ANA, GUS, 1);
    rows = [{ blocker_id: ANA, blocked_id: GUS }];
    const fromGus = await store.blockedWith(GUS);

    expect(calls[0]?.text).toMatch(/on conflict \(blocker_id, blocked_id\) do nothing/);
    expect([...fromGus]).toEqual([ANA]);
  });
});
