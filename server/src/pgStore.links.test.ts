import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The SQL of an ended link (ADR-0049), against a pool that records what it is asked.
 * The memory store carries the rules and runs under app.test.ts; what is checked here is
 * that Postgres gets the same three facts: both directions deleted, one row per pair in
 * a fixed order, and a new link forgetting the end.
 */

const calls: { text: string; values: unknown[] }[] = [];
let rows: Record<string, unknown>[] = [];

vi.mock('pg', () => {
  class Pool {
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      return { rows };
    }
    async end() {}
  }
  return { default: { Pool } };
});

const { createPgStore, pairOf } = await import('./pgStore.ts');

const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';

beforeEach(() => {
  calls.length = 0;
  rows = [];
});

describe('ending a link in Postgres', () => {
  it('keys the pair in one order, whoever ends it', () => {
    expect(pairOf(ANA, GUS)).toEqual([GUS, ANA]);
    expect(pairOf(GUS, ANA)).toEqual([GUS, ANA]);
  });

  it('deletes both directions and records the end once per pair', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.endLink(ANA, GUS, 42);

    expect(calls[0]?.text).toMatch(/delete from links/);
    expect(calls[0]?.values).toEqual([ANA, GUS]);
    expect(calls[0]?.text).toMatch(/owner_id = \$1 and member_id = \$2\) or \(owner_id = \$2 and member_id = \$1/);
    expect(calls[1]?.text).toMatch(/insert into ended_links/);
    expect(calls[1]?.text).toMatch(/on conflict \(a_id, b_id\) do update/);
    expect(calls[1]?.values).toEqual([GUS, ANA, 42]);
  });

  it('reads the other person of each pair, from either side', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    rows = [
      { a_id: GUS, b_id: ANA, ended_at: '50' },
      { a_id: ANA, b_id: GUS, ended_at: '60' },
    ];

    const ended = await store.endedLinksOf(GUS, 10);

    expect(calls[0]?.values).toEqual([GUS, 10]);
    expect(ended).toEqual([
      { otherId: ANA, endedAt: 50 },
      { otherId: ANA, endedAt: 60 },
    ]);
  });

  it('forgets the end when a new link is written between the two', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.putLink({ ownerId: GUS, memberId: ANA, status: 'pending', createdAt: 1, updatedAt: 1 });

    expect(calls[1]?.text).toMatch(/delete from ended_links where a_id = \$1 and b_id = \$2/);
    expect(calls[1]?.values).toEqual([GUS, ANA]);
  });
});
