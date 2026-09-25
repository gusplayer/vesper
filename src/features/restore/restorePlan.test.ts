import { describe, expect, it } from 'vitest';

import { inviteCodeFor } from '../../domain/circle';
import { ME, type Challenge, type Profile } from '../../domain/types';
import type { RemoteAccount, RemoteMark } from '../../platform/circleApi';
import {
  accountFailureResult,
  afterBackup,
  canRetry,
  challengesToRejoin,
  finalResult,
  generationOf,
  marksToRestore,
  mergeProfile,
  profileFromAccount,
  restoredSource,
  restoreFinished,
} from './restorePlan';

const ID = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const GYM = '0199a1b2-c3d4-7e5f-8a9b-0000000000c1';
const READ = '0199a1b2-c3d4-7e5f-8a9b-0000000000c2';

function codeAt(generation: number): string {
  return inviteCodeFor({ id: ID, name: '', handle: '', codeGeneration: generation, createdAt: 0 });
}

function account(patch: Partial<RemoteAccount> = {}): RemoteAccount {
  return { id: ID, name: 'Gus', handle: 'gus', inviteCode: codeAt(0), createdAt: 5, ...patch };
}

function challenge(patch: Partial<Challenge>): Challenge {
  return {
    id: GYM,
    name: 'Gimnasio',
    weeklyTarget: 3,
    startWeekKey: '2026-06-01',
    endDayKey: null,
    createdBy: ME,
    participantIds: [ME],
    habitId: null,
    createdAt: 1,
    archivedAt: null,
    ...patch,
  };
}

function mark(dayKey: string, patch: Partial<RemoteMark> = {}): RemoteMark {
  return { challengeId: GYM, accountId: ID, dayKey, source: 'manual', updatedAt: 1, ...patch };
}

describe('what a failed GET /account means to the person', () => {
  it('says wrong key for a key the server does not know, offline for no answer', () => {
    expect(accountFailureResult({ kind: 'unauthorized' })).toBe('wrongKey');
    expect(accountFailureResult({ kind: 'notFound' })).toBe('wrongKey');
    expect(accountFailureResult({ kind: 'offline' })).toBe('offline');
    expect(accountFailureResult({ kind: 'rateLimited', retryAfterMs: 1 })).toBe('failed');
    expect(accountFailureResult({ kind: 'serverError', status: 502 })).toBe('failed');
  });
});

describe('the backup, before the secret changes', () => {
  it('stops before rotating when the backup cannot be opened yet, so it is not lost', () => {
    // A newer app or a failed download: the old key still opens it later.
    expect(afterBackup('newerApp')).toEqual({ stop: 'newerApp' });
    expect(afterBackup('failed')).toEqual({ stop: 'failed' });
  });

  it('goes on when there is nothing to lose', () => {
    expect(afterBackup('restored')).toEqual({ go: 'restored' });
    expect(afterBackup('none')).toEqual({ go: 'none' });
    expect(afterBackup('undecryptable')).toEqual({ go: 'unreadable' });
  });

  it('ends in one sentence', () => {
    expect(finalResult('restored', true)).toBe('restored');
    expect(finalResult('restored', false)).toBe('restored');
    expect(finalResult('none', true)).toBe('circleOnly');
    expect(finalResult('none', false)).toBe('keyOnly');
    expect(finalResult('unreadable', true)).toBe('unreadable');
  });

  it('offers a retry only where nothing changed and trying later can work', () => {
    expect(canRetry('offline')).toBe(true);
    expect(canRetry('failed')).toBe(true);
    expect(canRetry('wrongKey')).toBe(false);
    expect(canRetry('newerApp')).toBe(false);
    expect(restoreFinished('circleOnly')).toBe(true);
    expect(restoreFinished('wrongKey')).toBe(false);
  });
});

describe('the invite-code generation the server holds', () => {
  it('is found by deriving each generation until one matches', () => {
    expect(generationOf(ID, codeAt(0))).toBe(0);
    expect(generationOf(ID, codeAt(3))).toBe(3);
    expect(generationOf(ID, codeAt(3).toLowerCase())).toBe(3);
  });

  it('is null for no code, or a code no generation up to the limit derives', () => {
    expect(generationOf(ID, null)).toBeNull();
    expect(generationOf(ID, codeAt(10), 5)).toBeNull();
    expect(generationOf(ID, 'ZZZZZZ', 64)).toBeNull();
  });
});

describe('the circle profile, rebuilt', () => {
  it('comes from the server when there was no backup', () => {
    expect(profileFromAccount(account({ inviteCode: codeAt(2) }), 99)).toEqual({
      profile: { id: ID, name: 'Gus', handle: 'gus', codeGeneration: 2, createdAt: 5 },
      confirmedGeneration: 2,
    });
  });

  it('is nothing for an identity that never claimed a handle', () => {
    expect(profileFromAccount(account({ handle: null, name: null, inviteCode: null }), 99)).toBeNull();
  });

  it('falls back to the handle for the name, and generation 0 unconfirmed without a code', () => {
    expect(profileFromAccount(account({ name: null, inviteCode: null, createdAt: null }), 99)).toEqual({
      profile: { id: ID, name: 'gus', handle: 'gus', codeGeneration: 0, createdAt: 99 },
      confirmedGeneration: null,
    });
  });

  it("keeps the backup's profile, with the server's name, handle and code", () => {
    const local: Profile = { id: ID, name: 'Viejo', handle: 'viejo', codeGeneration: 1, createdAt: 3 };
    expect(mergeProfile(local, account({ inviteCode: codeAt(4) }), 99)).toEqual({
      profile: { id: ID, name: 'Gus', handle: 'gus', codeGeneration: 4, createdAt: 3 },
      confirmedGeneration: 4,
    });
  });

  it('ignores a local profile that belongs to another id', () => {
    const other: Profile = { id: READ, name: 'Otro', handle: 'otro', codeGeneration: 7, createdAt: 3 };
    expect(mergeProfile(other, account(), 99)?.profile.id).toBe(ID);
  });
});

describe("the user's own marks, folded back into their habits", () => {
  it('goes into the habit of each challenge, one mark per day', () => {
    const marks = marksToRestore(
      [mark('2026-07-01'), mark('2026-07-03'), mark('2026-07-03')],
      [challenge({ habitId: 'habit-gym' })],
      [],
    );
    expect(marks).toEqual([
      { habitId: 'habit-gym', dayKey: '2026-07-01', source: 'manual' },
      { habitId: 'habit-gym', dayKey: '2026-07-03', source: 'manual' },
    ]);
  });

  it('is a union: a day already marked here stays as it is', () => {
    const marks = marksToRestore(
      [mark('2026-07-01'), mark('2026-07-02', { source: 'session' })],
      [challenge({ habitId: 'habit-gym' })],
      [{ habitId: 'habit-gym', dayKey: '2026-07-01' }],
    );
    expect(marks).toEqual([{ habitId: 'habit-gym', dayKey: '2026-07-02', source: 'session' }]);
  });

  it('leaves out a challenge with no habit here (rule 4 had no room for it)', () => {
    const marks = marksToRestore(
      [mark('2026-07-01'), mark('2026-07-01', { challengeId: READ })],
      [challenge({ habitId: 'habit-gym' }), challenge({ id: READ, habitId: null })],
      [],
    );
    expect(marks).toEqual([{ habitId: 'habit-gym', dayKey: '2026-07-01', source: 'manual' }]);
  });

  it('keeps a Health mark verified: a read of Health replaces only its own week', () => {
    expect(restoredSource('health')).toBe('health');
    expect(restoredSource('session')).toBe('session');
    expect(
      marksToRestore([mark('2026-07-01', { source: 'health' })], [challenge({ habitId: 'h' })], [])[0]?.source,
    ).toBe('health');
  });
});

describe('the challenges that need their habit back', () => {
  it('are the running ones the user is in with no habit on this phone', () => {
    const rejoin = challengesToRejoin([
      challenge({ id: 'a' }),
      challenge({ id: 'b', habitId: 'h' }),
      challenge({ id: 'c', participantIds: ['someone'] }),
      challenge({ id: 'd', archivedAt: 9 }),
    ]);
    expect(rejoin.map((c) => c.id)).toEqual(['a']);
  });
});
