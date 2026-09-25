import { circleFull, codeFromInviteLink, isOwnInviteCode, normalizeInviteCode } from '../../domain/circle';
import type { Member, Profile } from '../../domain/types';
import type { AccountOutcome, RedeemOutcome } from '../../platform/hooks/useCircleSync';

/**
 * What a typed code and a born account amount to, in words the two invitation screens
 * (`circle/invite`, `circle/join`) can both put on a line (ADR-0044 §5).
 *
 * Pure on purpose: the screens do the awaiting, this decides. Two jobs.
 *
 * - **What never needs the network.** A code that is not six symbols, one of the
 *   user's own, a circle that is already full: all three are known here, and sending
 *   them would spend one of the ten redemptions the server allows in an hour to be
 *   told something this phone already knew (server/README.md).
 * - **What a failed account claim means.** `ensureCircleAccount` answers in the
 *   client's vocabulary; a screen shows one line. This is the map between them, and
 *   it never collapses into "something went wrong": a taken handle is a thing the
 *   user can fix, a missing key is not, and being offline is neither.
 *
 * The 12-seat cap is checked here and not on the server: asking to join someone's
 * circle takes one of your own seats too — the link is mutual (ADR-0021, rule 11) —
 * and the server has no opinion about it.
 */

/** Everything a line under the code field may say. Only two of them are good news. */
export type InviteAttempt = RedeemOutcome | 'invalid' | 'self' | 'full';

/** The user's code is on its way, or it never left. */
export type CodeCheck =
  | { kind: 'send'; code: string }
  | { kind: 'stop'; outcome: Extract<InviteAttempt, 'invalid' | 'self' | 'full' | 'noProfile'> };

/**
 * A typed code or a pasted link, weighed against what this phone already knows. Only
 * `send` reaches the server.
 */
export function checkInviteCode(
  profile: Profile | null,
  members: readonly Member[],
  text: string,
): CodeCheck {
  const code = normalizeInviteCode(codeFromInviteLink(text) ?? text);
  if (code === null) {
    return { kind: 'stop', outcome: 'invalid' };
  }
  if (profile === null) {
    return { kind: 'stop', outcome: 'noProfile' };
  }
  if (isOwnInviteCode(profile, code)) {
    return { kind: 'stop', outcome: 'self' };
  }
  if (circleFull(members)) {
    return { kind: 'stop', outcome: 'full' };
  }
  return { kind: 'send', code };
}

/** Whether the line is a refusal (danger) or a receipt (secondary). */
export function attemptFailed(outcome: InviteAttempt): boolean {
  return outcome !== 'sent' && outcome !== 'alreadyMember';
}

/**
 * Whether asking again can answer differently. Only a request that never arrived, or a
 * wait the server asked for, can: everything else — an unknown code, the user's own, a
 * handle to change, a phone without the key — answers the same way every time, and each
 * try spends one of the ten redemptions the server allows in an hour.
 */
export function attemptRetryable(outcome: InviteAttempt): boolean {
  return outcome === 'offline' || outcome === 'tooMany' || outcome === 'server';
}

/** Whether the way out of this line is Ajustes › Círculo, to change the handle. */
export function attemptNeedsHandle(outcome: InviteAttempt | AccountProblem | null): boolean {
  return outcome === 'handleTaken' || outcome === 'handleInvalid';
}

/**
 * Why the account could not be born (ADR-0044 §2). Null when it was.
 *
 * `lostKey` is the one that reads like a bug and is not: the server already holds an
 * account for this profile id and this phone has no key for it, which is what a
 * reinstall without the backup key looks like. `codeTaken` is the opposite — three
 * generations in a row collided, which at 32⁶ codes is not bad luck — and the answer
 * to it is the button that is already on the screen, "Generar código nuevo".
 */
export type AccountProblem =
  | 'handleTaken'
  | 'handleInvalid'
  | 'noKeychain'
  | 'noProfile'
  | 'offline'
  | 'busy'
  | 'lostKey'
  | 'codeTaken'
  | 'server';

export function accountProblem(outcome: AccountOutcome): AccountProblem | null {
  switch (outcome.kind) {
    case 'ok':
      return null;
    case 'handleTaken':
      return 'handleTaken';
    case 'handleInvalid':
      return 'handleInvalid';
    case 'noKeychain':
      return 'noKeychain';
    case 'noProfile':
      return 'noProfile';
    case 'failed':
      break;
  }
  switch (outcome.failure.kind) {
    case 'offline':
      return 'offline';
    case 'rateLimited':
      return 'busy';
    case 'unauthorized':
      return 'lostKey';
    case 'inviteCodeTaken':
      return 'codeTaken';
    default:
      // A 400, a 403, a 404 and a 5xx are one fact to the person holding the phone:
      // the server would not do it, and nothing they type changes that.
      return 'server';
  }
}
