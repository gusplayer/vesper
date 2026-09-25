import { describe, expect, it } from 'vitest';

import { inviteLinkFor } from '../../domain/circle';
import { codeFieldText, invitePageLinkFor } from './inviteLink';

describe('invitePageLinkFor', () => {
  it('sends the invitation page, which opens on a phone without Vesper (ADR-0034)', () => {
    expect(invitePageLinkFor('ABC234')).toBe('https://vesper-azure.vercel.app/join?code=ABC234');
  });
});

describe('codeFieldText', () => {
  it('keeps the code out of a pasted page link, scheme link or whole share message', () => {
    expect(codeFieldText(invitePageLinkFor('ABC234'))).toBe('ABC234');
    expect(codeFieldText(inviteLinkFor('abc234'))).toBe('ABC234');
    expect(codeFieldText(`Únete a mi círculo en Vesper: ${invitePageLinkFor('XYZ789')} · Código XYZ789`)).toBe(
      'XYZ789',
    );
  });

  it('leaves what was typed alone', () => {
    expect(codeFieldText('abc2')).toBe('abc2');
  });
});
