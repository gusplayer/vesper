import { codeFromInviteLink } from '../../domain/circle';

/**
 * The invitation as it leaves the phone: the web page of ADR-0034, not the app's own
 * scheme. `vesper://circle/join?code=…` opens nothing on a phone without Vesper and most
 * messengers do not even make it tappable; the page shows the code in large type, says
 * what a circle is, and its "Abrir Vesper" jumps to that same scheme. The code inside is
 * what matters, so a pasted page link and a pasted scheme link read the same way
 * (`codeFromInviteLink` looks for `code=` anywhere).
 *
 * The host is the one Vercel gives until there is a domain of our own (ADR-0034,
 * "Dominio"); links already sent keep working because the code, not the host, is the key.
 */
export const INVITE_PAGE_PREFIX = 'https://vesper-azure.vercel.app/join?code=';

export function invitePageLinkFor(code: string): string {
  return `${INVITE_PAGE_PREFIX}${code}`;
}

/**
 * What the code field keeps from what was typed or pasted: the code alone when the text
 * carries a link (or the whole share message), the text as it is otherwise. A link is
 * never cut to six characters before the code inside it can be read.
 */
export function codeFieldText(text: string): string {
  return codeFromInviteLink(text) ?? text;
}
