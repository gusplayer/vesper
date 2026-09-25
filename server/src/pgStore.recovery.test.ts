import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The SQL of the recovery email (ADR-0050), against a pool that records what it is
 * asked. The rules run under app.test.ts on the memory store; what is checked here is
 * that Postgres gets the two things only SQL can promise: an attempt counted and checked
 * in one statement, and an email moved between accounts inside one transaction.
 */

const calls: { text: string; values: unknown[] }[] = [];
let rows: Record<string, unknown>[] = [];
/** Errors to throw, in order, from the client's inserts. */
let insertErrors: unknown[] = [];

vi.mock('pg', () => {
  const run = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    if (text.includes('insert into recovery ') && insertErrors.length > 0) {
      throw insertErrors.shift();
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

beforeEach(() => {
  calls.length = 0;
  rows = [];
  insertErrors = [];
});

const recovery = {
  accountId: GUS,
  email: 'gus@example.com',
  secretEnc: 'sealed',
  verifiedAt: 1,
  updatedAt: 1,
};

describe('the recovery email in Postgres', () => {
  it('counts an attempt and checks the cap in one statement', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    rows = [
      {
        purpose: 'recover',
        subject: 'gus@example.com',
        account_id: null,
        email: 'gus@example.com',
        code_hash: 'h',
        attempts: 3,
        expires_at: '600000',
        created_at: '0',
      },
    ];

    const spent = await store.spendRecoveryAttempt('recover', 'gus@example.com', 5);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toMatch(/update recovery_codes set attempts = attempts \+ 1/);
    expect(calls[0]?.text).toMatch(/attempts < \$3/);
    expect(calls[0]?.text).toMatch(/returning \*/);
    expect(calls[0]?.values).toEqual(['recover', 'gus@example.com', 5]);
    expect(spent).toEqual(
      expect.objectContaining({ purpose: 'recover', accountId: null, attempts: 3, expiresAt: 600000 }),
    );
  });

  it('moves an email to its new account inside one transaction', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    await store.putRecovery(recovery);

    expect(calls.map((call) => call.text.trim().split(/\s+/).slice(0, 3).join(' '))).toEqual([
      'begin',
      'delete from recovery',
      'insert into recovery',
      'commit',
      'release',
    ]);
    expect(calls[1]?.values).toEqual(['gus@example.com', GUS]);
  });

  it('tries once more when another account took the email in the same instant', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    insertErrors = [{ code: '23505', constraint: 'recovery_email_key' }];

    await store.putRecovery(recovery);

    expect(calls.filter((call) => call.text === 'rollback')).toHaveLength(1);
    expect(calls.filter((call) => call.text === 'commit')).toHaveLength(1);
    expect(calls.filter((call) => call.text === 'release')).toHaveLength(2);
  });

  it('gives up after the second conflict instead of looping', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');
    const conflict = { code: '23505', constraint: 'recovery_email_key' };
    insertErrors = [conflict, conflict];

    await expect(store.putRecovery(recovery)).rejects.toBe(conflict);
    expect(calls.filter((call) => call.text === 'release')).toHaveLength(2);
  });

  it('consumes a code only while it is still the same code', async () => {
    const store = createPgStore('postgres://localhost:5432/vesper');

    const consumed = await store.consumeRecoveryCode('verify', GUS, 'h');

    expect(calls[0]?.text).toMatch(/delete from recovery_codes where purpose = \$1 and subject = \$2 and code_hash = \$3/);
    expect(consumed).toBe(false);
  });
});
