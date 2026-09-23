import { describe, expect, it } from 'vitest';

import { derivesFrom, inviteCodeFor, MAX_CODE_GENERATION, normalizeInviteCode } from './invite.ts';

/**
 * The port has to agree with the phone symbol for symbol, or the server would refuse
 * the code the app is showing on screen. These are the codes `inviteCodeFor` in
 * `src/domain/circle.ts` produces for these ids — computed from that file, not from this
 * one, which is the only way the check is worth anything.
 */
const GUS = '0199a1b2-c3d4-7e5f-8a9b-000000000001';
const ANA = '0199a1b2-c3d4-7e5f-8a9b-000000000002';

describe('the invite code', () => {
  it('derives the six symbols the phone shows', () => {
    expect(inviteCodeFor(GUS, 0)).toBe('LD6FYR');
    expect(inviteCodeFor(GUS, 1)).toBe('7SRUK6');
    expect(inviteCodeFor(GUS, 2)).toBe('EKC9SX');
    expect(inviteCodeFor(ANA, 0)).toBe('5UTAH8');
  });

  it('uses no symbol that can be misread', () => {
    // No 0, O, 1 or I: the code is typed by hand off someone else's screen.
    for (let generation = 0; generation < 200; generation += 1) {
      expect(inviteCodeFor(GUS, generation)).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('knows a code its own account has shown, at any generation it could have reached', () => {
    expect(derivesFrom(GUS, 'LD6FYR')).toBe(true);
    expect(derivesFrom(GUS, inviteCodeFor(GUS, MAX_CODE_GENERATION))).toBe(true);
    // Somebody else's code, which is the whole point of asking.
    expect(derivesFrom(GUS, '5UTAH8')).toBe(false);
  });

  it('checks the exact generation when it is given', () => {
    expect(derivesFrom(GUS, 'LD6FYR', 0)).toBe(true);
    expect(derivesFrom(GUS, 'LD6FYR', 1)).toBe(false);
    expect(derivesFrom(GUS, '7SRUK6', 1)).toBe(true);
  });

  it('refuses a generation nobody could have tapped to', () => {
    expect(derivesFrom(GUS, inviteCodeFor(GUS, 10_000), 10_000)).toBe(false);
    expect(derivesFrom(GUS, 'LD6FYR', -1)).toBe(false);
    expect(derivesFrom(GUS, 'LD6FYR', 1.5)).toBe(false);
  });

  it('cleans up what a person typed, and refuses what is not a code', () => {
    expect(normalizeInviteCode('  ld6fyr ')).toBe('LD6FYR');
    expect(normalizeInviteCode('LD6FY')).toBeNull();
    expect(normalizeInviteCode('LD6FYRR')).toBeNull();
    // 0, O, 1 and I are not in the alphabet, so they are not codes either.
    expect(normalizeInviteCode('LD0FYR')).toBeNull();
    expect(normalizeInviteCode("' or 1=1 --")).toBeNull();
  });
});
