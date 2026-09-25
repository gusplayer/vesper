import { inviteCodeFor } from '../../domain/circle';
import { ME, type Challenge, type MarkSource, type Profile } from '../../domain/types';
import type { RestoreOutcome } from '../../platform/backup';
import type { ApiFailure, RemoteAccount, RemoteMark } from '../../platform/circleApi';

/**
 * The decisions of a restore with the backup key (ADR-0048 §5–§7), pure so vitest can
 * hold them: what a failure means to the person, which invite-code generation the
 * server holds, the circle profile it knows, and which of their own marks go back into
 * their habits. `runRestore` does the talking; this does the deciding.
 */

/**
 * What the restoring screen says, one sentence each.
 *
 * - `restored`: the backup is on this phone (and the circle, if there was one).
 * - `circleOnly`: no backup on the server; the circle and the challenge marks came back.
 * - `keyOnly`: the key works, and there was nothing on the server to bring back.
 * - `unreadable`: there is a backup, and this key does not open it; the circle came back.
 * - `wrongKey`: the server does not know this key.
 * - `offline`: nobody answered. Nothing changed; trying again is safe.
 * - `newerApp`: the backup was written by a newer Vesper. Nothing changed.
 * - `noKeychain`: this build cannot keep a key, so nothing was changed on the server.
 * - `failed`: anything else. Nothing changed that trying again cannot finish.
 */
export type RestoreResult =
  | 'restored'
  | 'circleOnly'
  | 'keyOnly'
  | 'unreadable'
  | 'wrongKey'
  | 'offline'
  | 'newerApp'
  | 'noKeychain'
  | 'failed';

/** Whether the screen offers "Intentar de nuevo": nothing was changed and it may work later. */
export function canRetry(result: RestoreResult): boolean {
  return result === 'offline' || result === 'failed';
}

/** Whether the restore finished: the phone now is the restored Vesper. */
export function restoreFinished(result: RestoreResult): boolean {
  return result === 'restored' || result === 'circleOnly' || result === 'keyOnly' || result === 'unreadable';
}

/** `GET /account` did not answer with a profile: what that means to the person. */
export function accountFailureResult(failure: ApiFailure): RestoreResult {
  switch (failure.kind) {
    case 'unauthorized':
    case 'notFound':
      return 'wrongKey';
    case 'offline':
      return 'offline';
    default:
      return 'failed';
  }
}

/**
 * The backup's answer, before anything irreversible happens. `stop` means the restore
 * ends here with nothing rotated: the backup can still be opened with the key it was
 * sealed with, and rotating now would lose it for good (ADR-0048 §7: download, decrypt,
 * rotate, upload — in that order).
 */
export function afterBackup(outcome: RestoreOutcome): { stop: RestoreResult } | { go: 'restored' | 'none' | 'unreadable' } {
  switch (outcome) {
    case 'restored':
      return { go: 'restored' };
    case 'none':
      return { go: 'none' };
    case 'undecryptable':
      // Damaged bytes, or sealed with a key that is not this one: nothing can open it,
      // now or later. The circle still comes back, and the next backup replaces it.
      return { go: 'unreadable' };
    case 'newerApp':
      return { stop: 'newerApp' };
    case 'failed':
      return { stop: 'failed' };
  }
}

/** The sentence at the end, once the key worked and the secret changed. */
export function finalResult(backup: 'restored' | 'none' | 'unreadable', circle: boolean): RestoreResult {
  if (backup === 'restored') {
    return 'restored';
  }
  if (backup === 'unreadable') {
    return 'unreadable';
  }
  return circle ? 'circleOnly' : 'keyOnly';
}

/** How far the search for a code's generation goes. "Generar código nuevo" is rare. */
export const MAX_CODE_GENERATION = 64;

/**
 * The invite-code generation whose code is `inviteCode`, for the account `id`: the
 * server keeps the six symbols, not the generation, and the phone has to derive the same
 * ones to show the same QR. Null when no generation up to the limit matches — the next
 * claim then takes a fresh one.
 */
export function generationOf(id: string, inviteCode: string | null, max = MAX_CODE_GENERATION): number | null {
  if (inviteCode === null) {
    return null;
  }
  const wanted = inviteCode.toUpperCase();
  for (let generation = 0; generation <= max; generation += 1) {
    if (inviteCodeFor({ id, name: '', handle: '', codeGeneration: generation, createdAt: 0 }) === wanted) {
      return generation;
    }
  }
  return null;
}

/**
 * The circle profile the server knows, rebuilt on a phone without a backup. Null when
 * the account never claimed one (no handle): an identity that never used the circle.
 * The name falls back to the handle, which is what a challenge shows anyway.
 */
export function profileFromAccount(
  account: RemoteAccount,
  now: number,
): { profile: Profile; confirmedGeneration: number | null } | null {
  if (account.handle === null) {
    return null;
  }
  const confirmedGeneration = generationOf(account.id, account.inviteCode);
  return {
    profile: {
      id: account.id,
      name: account.name ?? account.handle,
      handle: account.handle,
      codeGeneration: confirmedGeneration ?? 0,
      createdAt: account.createdAt ?? now,
    },
    confirmedGeneration,
  };
}

/**
 * The profile a restored backup brought, corrected by what the server knows: the name
 * and the handle are the server's to show, and the code is whichever generation the
 * server holds. Null when the backup's profile is not this account's.
 */
export function mergeProfile(
  local: Profile | null,
  account: RemoteAccount,
  now: number,
): { profile: Profile; confirmedGeneration: number | null } | null {
  const remote = profileFromAccount(account, now);
  if (remote === null) {
    return null;
  }
  if (local === null || local.id !== account.id) {
    return remote;
  }
  return {
    profile: {
      ...local,
      name: remote.profile.name,
      handle: remote.profile.handle,
      codeGeneration: remote.confirmedGeneration ?? local.codeGeneration,
    },
    confirmedGeneration: remote.confirmedGeneration,
  };
}

/**
 * The source a restored mark keeps: its own. A Health mark stays verified (ADR-0005:
 * it was counted by Health on the phone that wrote it, and turning it into a manual one
 * would mix the two). A read of Health replaces only the week it read (useHealthSync),
 * so the older ones survive it, and this week's are what Health on this phone says.
 */
export function restoredSource(source: MarkSource): MarkSource {
  return source;
}

/** The challenges the user is in that have no habit on this phone yet: each needs one. */
export function challengesToRejoin(challenges: readonly Challenge[]): Challenge[] {
  return challenges.filter(
    (challenge) => challenge.archivedAt === null && challenge.participantIds.includes(ME) && challenge.habitId === null,
  );
}

export type MarkToRestore = { habitId: string; dayKey: string; source: MarkSource };

/**
 * The user's own challenge marks, folded into their habits as a union (ADR-0048 §6):
 * one mark per habit and day, and only on a day that habit has no mark yet — a mark
 * already here, from the backup or from Health, is kept as it is. A challenge without a
 * habit on this phone (a sixth habit it could not get, rule 4) contributes nothing.
 */
export function marksToRestore(
  ownMarks: readonly RemoteMark[],
  challenges: readonly Pick<Challenge, 'id' | 'habitId'>[],
  existing: readonly { habitId: string; dayKey: string }[],
): MarkToRestore[] {
  const habitOf = new Map<string, string>();
  for (const challenge of challenges) {
    if (challenge.habitId !== null) {
      habitOf.set(challenge.id, challenge.habitId);
    }
  }
  const taken = new Set(existing.map((mark) => `${mark.habitId}/${mark.dayKey}`));
  const out: MarkToRestore[] = [];
  for (const mark of ownMarks) {
    const habitId = habitOf.get(mark.challengeId);
    if (habitId === undefined) {
      continue;
    }
    const key = `${habitId}/${mark.dayKey}`;
    if (taken.has(key)) {
      continue;
    }
    taken.add(key);
    out.push({ habitId, dayKey: mark.dayKey, source: restoredSource(mark.source) });
  }
  return out;
}
