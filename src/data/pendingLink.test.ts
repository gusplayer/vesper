import { beforeEach, describe, expect, it } from 'vitest';

import { inviteCodeFromPath, takePendingInvite, usePendingLink } from './pendingLink';

beforeEach(() => {
  usePendingLink.getState().setInviteCode(null);
});

describe('inviteCodeFromPath', () => {
  it('reads the code from every shape the OS hands over', () => {
    expect(inviteCodeFromPath('vesper://circle/join?code=ABC234')).toBe('ABC234');
    expect(inviteCodeFromPath('/circle/join?code=ABC234')).toBe('ABC234');
    expect(inviteCodeFromPath('circle/join?code=ABC234')).toBe('ABC234');
    expect(inviteCodeFromPath('vesper://circle/join/?x=1&code=abc-234')).toBe('abc-234');
  });

  it('decodes an escaped code and trims it', () => {
    expect(inviteCodeFromPath('vesper://circle/join?code=%20AB%2BC%20')).toBe('AB+C');
  });

  it('is null for any other path, or an invitation without a code', () => {
    expect(inviteCodeFromPath('vesper://session/active')).toBeNull();
    expect(inviteCodeFromPath('/circle/invite?code=ABC')).toBeNull();
    expect(inviteCodeFromPath('/circle/joinx?code=ABC')).toBeNull();
    expect(inviteCodeFromPath('vesper://circle/join')).toBeNull();
    expect(inviteCodeFromPath('vesper://circle/join?code=')).toBeNull();
  });

  it('never throws on a malformed escape', () => {
    expect(inviteCodeFromPath('vesper://circle/join?code=%E0%A4%A')).toBeNull();
  });
});

describe('takePendingInvite', () => {
  it('hands the parked code over once', () => {
    usePendingLink.getState().setInviteCode('ABC234');

    expect(takePendingInvite()).toBe('ABC234');
    expect(takePendingInvite()).toBeNull();
  });
});
