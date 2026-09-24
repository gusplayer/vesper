import { describe, expect, it } from 'vitest';

import { inviteCodeFor, inviteLinkFor } from '../../domain/circle';
import { MAX_CIRCLE, type Member, type Profile } from '../../domain/types';
import { accountProblem, attemptFailed, checkInviteCode } from './inviteAttempt';

const profile: Profile = {
  id: '0199a1b2-c3d4-7e5f-8a9b-000000000001',
  name: 'Gus',
  handle: 'gus',
  codeGeneration: 0,
  createdAt: 1,
};

const other: Profile = { ...profile, id: '0199a1b2-c3d4-7e5f-8a9b-0000000000ff' };

function members(count: number): Member[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    name: `m${i}`,
    handle: `m${i}`,
    status: 'member' as const,
    joinedAt: 1,
    createdAt: 1,
  }));
}

describe('checkInviteCode', () => {
  it('sends a well-formed code that belongs to somebody else', () => {
    expect(checkInviteCode(profile, [], inviteCodeFor(other))).toEqual({
      kind: 'send',
      code: inviteCodeFor(other),
    });
  });

  it('accepts a pasted invite link, lowercase and with text around it', () => {
    const code = inviteCodeFor(other);
    const pasted = `únete: ${inviteLinkFor(code).toLowerCase()} ahí nos vemos`;
    expect(checkInviteCode(profile, [], pasted)).toEqual({ kind: 'send', code });
  });

  it('stops anything that is not six symbols before it reaches the server', () => {
    for (const text of ['', 'ABCDE', 'ABC01O', 'not a code at all']) {
      expect(checkInviteCode(profile, [], text)).toEqual({ kind: 'stop', outcome: 'invalid' });
    }
  });

  it('stops the user own code, in any generation they ever showed', () => {
    const regenerated = { ...profile, codeGeneration: 2 };
    for (const generation of [0, 1, 2]) {
      const code = inviteCodeFor({ ...profile, codeGeneration: generation });
      expect(checkInviteCode(regenerated, [], code)).toEqual({ kind: 'stop', outcome: 'self' });
    }
  });

  it('asks for a profile before anything else that needs one', () => {
    expect(checkInviteCode(null, [], inviteCodeFor(other))).toEqual({
      kind: 'stop',
      outcome: 'noProfile',
    });
    // Still 'invalid' first: there is nothing to look a profile up against.
    expect(checkInviteCode(null, [], 'nope')).toEqual({ kind: 'stop', outcome: 'invalid' });
  });

  it('stops at the twelfth seat, because asking takes one of yours too', () => {
    const code = inviteCodeFor(other);
    expect(checkInviteCode(profile, members(MAX_CIRCLE - 1), code).kind).toBe('send');
    expect(checkInviteCode(profile, members(MAX_CIRCLE), code)).toEqual({
      kind: 'stop',
      outcome: 'full',
    });
  });

  it('calls the code your own before it calls the circle full', () => {
    expect(checkInviteCode(profile, members(MAX_CIRCLE), inviteCodeFor(profile))).toEqual({
      kind: 'stop',
      outcome: 'self',
    });
  });
});

describe('attemptFailed', () => {
  it('reads a sent request and an existing link as good news', () => {
    expect(attemptFailed('sent')).toBe(false);
    expect(attemptFailed('alreadyMember')).toBe(false);
  });

  it('reads everything else as a refusal', () => {
    for (const outcome of ['invalid', 'self', 'full', 'unknownCode', 'ownCode', 'tooMany', 'offline', 'handleTaken', 'noProfile'] as const) {
      expect(attemptFailed(outcome)).toBe(true);
    }
  });
});

describe('accountProblem', () => {
  it('is null when the account was born', () => {
    expect(accountProblem({ kind: 'ok', credentials: { id: profile.id, secret: 's' } })).toBeNull();
  });

  it('keeps the three answers the user can act on apart', () => {
    expect(accountProblem({ kind: 'handleTaken' })).toBe('handleTaken');
    expect(accountProblem({ kind: 'noKeychain' })).toBe('noKeychain');
    expect(accountProblem({ kind: 'noProfile' })).toBe('noProfile');
  });

  it('tells being offline apart from being told to wait', () => {
    expect(accountProblem({ kind: 'failed', failure: { kind: 'offline' } })).toBe('offline');
    expect(
      accountProblem({ kind: 'failed', failure: { kind: 'rateLimited', retryAfterMs: 60_000 } }),
    ).toBe('busy');
  });

  it('names the account that exists with no key on this phone', () => {
    expect(accountProblem({ kind: 'failed', failure: { kind: 'unauthorized' } })).toBe('lostKey');
  });

  it('names a code that three generations could not claim', () => {
    expect(accountProblem({ kind: 'failed', failure: { kind: 'inviteCodeTaken' } })).toBe('codeTaken');
  });

  it('folds everything the user cannot act on into one line', () => {
    expect(accountProblem({ kind: 'failed', failure: { kind: 'rejected', message: 'bad' } })).toBe('server');
    expect(accountProblem({ kind: 'failed', failure: { kind: 'notFound' } })).toBe('server');
    expect(accountProblem({ kind: 'failed', failure: { kind: 'forbidden' } })).toBe('server');
    expect(accountProblem({ kind: 'failed', failure: { kind: 'conflict', message: 'x' } })).toBe('server');
    expect(accountProblem({ kind: 'failed', failure: { kind: 'serverError', status: 503 } })).toBe('server');
  });
});
