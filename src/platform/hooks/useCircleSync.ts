import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data/stores/app';
import { useCircleStore } from '../../data/stores/circle';
import { sharedWeekUsageMs, useUsageStore } from '../../data/stores/usage';
import { weekDayKeys, weekKeyOf } from '../../domain/circle';
import { dayKeyOf, weekStart } from '../../domain/day';
import { weeklyProgress } from '../../domain/habits';
import { MINUTE } from '../../domain/time';
import { ME } from '../../domain/types';
import { clearCredentials, loadCredentials, saveCredentials } from '../circle';
import {
  acceptInvite,
  buildUpload,
  claimAccount,
  deleteAccount,
  foldDownload,
  joinChallenge,
  redeemInvite,
  sync,
  type ApiFailure,
  type Credentials,
} from '../circleApi';

/**
 * The circle's sync (ADR-0044 §4), in the shape every other platform hook has: a
 * function that talks to the outside, a hook that decides when, and a store that never
 * knows either exists.
 *
 * It runs on mount, when the app comes back to the front, right after the user writes
 * something of the circle's, and at most once every five minutes otherwise. Nothing it
 * does can fail loudly: a sync that cannot reach the server leaves every local row
 * exactly where it was and tells `status()` so (ADR-0044 §5).
 *
 * **The account is born here, and late.** Not when the profile is created — that stays
 * local and offline (rule 7) — but the first time the user needs somebody else to be
 * able to find them: inviting, or using a code (ADR-0044 §2). Until then this hook has
 * nothing to do and does nothing.
 */

/** The floor between two syncs that nobody asked for. The server allows three times this. */
export const SYNC_INTERVAL_MS = 5 * MINUTE;

type Memory = {
  lastSyncAt: number;
  /** A 429 told us to wait; nothing goes out before this instant. */
  notBefore: number;
  /**
   * Ids the server refused. They are not sent again while the app runs: the server is
   * the authority over what another person may see, and repeating a row it already
   * said no to only spends the budget (ADR-0044 §5).
   *
   * They are not deleted from SQLite. A refused cheer or nudge is refused because the
   * link behind it is not what this phone thought, and the members the same download
   * carries are what repairs that — deleting the row would take the user's own record
   * of what they did with it.
   */
  rejected: Set<string>;
};

const memory: Memory = { lastSyncAt: 0, notBefore: 0, rejected: new Set() };

/** One flight per account id: a second caller for the same account shares the answer. */
const inFlight = new Map<string, Promise<void>>();

/**
 * True while the store is being filled from a download. A sync fires after a local
 * write; without this flag, writing what the server just sent would ask for another
 * sync, and that one for another.
 */
let applyingRemote = false;

/** Forgets the cooldown. "Borrar todo y reiniciar", deleting the account, and tests. */
export function forgetCircleSync(): void {
  memory.lastSyncAt = 0;
  memory.notBefore = 0;
  memory.rejected.clear();
  inFlight.clear();
}

// --- The account ----------------------------------------------------------------------

export type AccountOutcome =
  | { kind: 'ok'; credentials: Credentials }
  /** There is no circle profile yet: the flow that creates one has to run first. */
  | { kind: 'noProfile' }
  /** The handle belongs to somebody else. The user picks another one. */
  | { kind: 'handleTaken' }
  /** This build cannot keep a secret, so it must not pretend to have an account. */
  | { kind: 'noKeychain' }
  | { kind: 'failed'; failure: ApiFailure };

/**
 * The account, created if this is the first time it is needed (ADR-0044 §2). Safe to
 * call again: with a marker and a key in the keychain it is one synchronous read.
 *
 * The secret is written to the keychain **before** the account is recorded as existing.
 * The other order would leave a phone convinced it has an account it can never sign a
 * request for, which is worse than no account: the server would hold the id and the
 * invite code of somebody who cannot prove they are them.
 */
export async function ensureCircleAccount(now: number): Promise<AccountOutcome> {
  const store = useCircleStore.getState();
  const profile = store.profile;
  if (profile === null) {
    return { kind: 'noProfile' };
  }
  const stored = await loadCredentials(profile.id);
  if (stored !== null) {
    // A key in the keychain with no marker beside it is an account this phone made
    // and then lost the note of: record it rather than create a second one.
    if (useCircleStore.getState().account === null) {
      useCircleStore.getState().setAccount({ id: profile.id, createdAt: now }, now);
    }
    return { kind: 'ok', credentials: stored };
  }

  const claimed = await claimAccount(profile, null);
  if (!claimed.ok) {
    return claimed.failure.kind === 'handleTaken'
      ? { kind: 'handleTaken' }
      : { kind: 'failed', failure: claimed.failure };
  }
  const secret = claimed.value.account.secret;
  if (secret === null) {
    // A 200 with no secret means the account already existed and this phone has no
    // key for it: the backup key is the only way back in (ADR-0044 §3).
    return { kind: 'failed', failure: { kind: 'unauthorized' } };
  }
  const credentials: Credentials = { id: profile.id, secret };
  if (!(await saveCredentials(credentials))) {
    return { kind: 'noKeychain' };
  }
  // The profile may have been deleted while the server was answering.
  const after = useCircleStore.getState();
  if (after.profile === null || after.profile.id !== profile.id) {
    await clearCredentials();
    return { kind: 'noProfile' };
  }
  if (claimed.value.codeGeneration !== profile.codeGeneration) {
    // Somebody else holds the code this profile derived, so the server took the next
    // generation instead. The phone has to show the same six symbols it registered.
    const bumps = claimed.value.codeGeneration - profile.codeGeneration;
    for (let i = 0; i < bumps; i += 1) {
      useCircleStore.getState().regenerateInviteCode(now);
    }
  }
  useCircleStore.getState().setAccount({ id: profile.id, createdAt: now }, now);
  return { kind: 'ok', credentials };
}

/**
 * "Generar código nuevo", once the account exists (ADR-0044 §2). The generation was
 * already bumped locally; this is what tells the server, and without it the six
 * symbols on screen are somebody else's — or nobody's — while the old code keeps
 * working. A collision bumps again, exactly as the first claim does, and the phone
 * keeps whichever generation stuck.
 *
 * Without an account yet there is nothing to re-claim: the ordinary birth does it.
 */
export async function claimInviteCode(now: number): Promise<AccountOutcome> {
  const profile = useCircleStore.getState().profile;
  if (profile === null) {
    return { kind: 'noProfile' };
  }
  const credentials = await loadCredentials(profile.id);
  if (credentials === null) {
    return ensureCircleAccount(now);
  }
  const claimed = await claimAccount(profile, credentials);
  if (!claimed.ok) {
    return claimed.failure.kind === 'handleTaken'
      ? { kind: 'handleTaken' }
      : { kind: 'failed', failure: claimed.failure };
  }
  const bumps = claimed.value.codeGeneration - profile.codeGeneration;
  for (let i = 0; i < bumps; i += 1) {
    useCircleStore.getState().regenerateInviteCode(now);
  }
  return { kind: 'ok', credentials };
}

export type RedeemOutcome =
  | 'sent'
  | 'alreadyMember'
  | 'unknownCode'
  | 'ownCode'
  | 'handleTaken'
  | 'noProfile'
  | 'tooMany'
  | 'noKeychain'
  | 'offline';

function redeemFailure(failure: ApiFailure): RedeemOutcome {
  switch (failure.kind) {
    case 'notFound':
      return 'unknownCode';
    case 'conflict':
      return 'ownCode';
    case 'rateLimited':
      return 'tooMany';
    default:
      return 'offline';
  }
}

/**
 * Using somebody's code. This is one of the two moments an account is born, and the
 * request it sends is a request: the other person still decides (ADR-0021 addendum).
 */
export async function redeemCircleCode(code: string, now: number): Promise<RedeemOutcome> {
  const account = await ensureCircleAccount(now);
  if (account.kind !== 'ok') {
    // Each failure keeps its own reason: a phone that cannot hold the key is not
    // a phone without a connection, and telling the user to try again later would
    // send them back to a wall (rule 8).
    switch (account.kind) {
      case 'handleTaken':
        return 'handleTaken';
      case 'noProfile':
        return 'noProfile';
      case 'noKeychain':
        return 'noKeychain';
      default:
        return 'offline';
    }
  }
  const result = await redeemInvite(account.credentials, code);
  if (!result.ok) {
    return redeemFailure(result.failure);
  }
  // The other person's row arrives with the next sync, not with this answer.
  await syncCircle(true);
  return result.value.status === 'member' ? 'alreadyMember' : 'sent';
}

/**
 * "Borrar la cuenta" (ADR-0044 §7), which is not "Salir del círculo": the account and
 * every row of it go from the server, the key goes from the keychain, and the app is
 * local again and still whole. False when the server could not be reached — nothing is
 * cleared then, because a key deleted here with the account still up there is an
 * account nobody can ever delete.
 */
export async function deleteCircleAccount(now: number): Promise<boolean> {
  const store = useCircleStore.getState();
  const profile = store.profile;
  if (profile === null || store.account === null) {
    return true;
  }
  const credentials = await loadCredentials(profile.id);
  if (credentials === null) {
    // There is an account but this phone lost its key, so the DELETE cannot be sent
    // and nobody will ever be able to send it. Clearing up locally is all that is
    // left, and saying it succeeded would be a lie: the row outlives the phone.
    await clearCredentials();
    useCircleStore.getState().clearAccount(now);
    forgetCircleSync();
    return false;
  }
  const result = await deleteAccount(credentials);
  // A 401 means the server does not know this key: the account is already gone as
  // far as this phone is concerned, so clearing up is the honest end.
  if (!result.ok && result.failure.kind !== 'unauthorized') {
    return false;
  }
  await clearCredentials();
  useCircleStore.getState().clearAccount(now);
  forgetCircleSync();
  return true;
}

// --- The sync ----------------------------------------------------------------------------

/** What this phone knows right now, gathered from the stores in one place. */
function collectUpload(accountId: string, now: number) {
  const app = useAppStore.getState();
  const circle = useCircleStore.getState();
  const weekKey = weekKeyOf(now);
  const weekDays = weekDayKeys(weekKey);
  const todayKey = dayKeyOf(now);
  const fromKey = dayKeyOf(weekStart(now));

  const focusMs = app.dayStats
    .filter((day) => weekDays.includes(day.dayKey))
    .reduce((total, day) => total + day.focusMs, 0);

  const active = app.habits.filter((habit) => habit.archivedAt === null);
  const weekMarks = app.habitMarks.filter((mark) => mark.dayKey >= fromKey && mark.dayKey <= todayKey);
  const progress = weeklyProgress(active, weekMarks, todayKey);
  const habitsDone = progress.reduce(
    (total, entry) => total + Math.min(entry.markedDays, entry.habit.weeklyTarget),
    0,
  );
  const habitsTarget = progress.reduce((total, entry) => total + entry.habit.weeklyTarget, 0);

  // Null while the usage floor is still the demo one: the seed's estimate must never
  // leave the phone as if it were this person's week (ADR-0035 §2).
  const socialMs = sharedWeekUsageMs(useUsageStore.getState());

  const oldestDay = weekDays[0] ?? todayKey;
  return buildUpload({
    since: circle.syncSince,
    weekKey,
    myWeek: { focusMs, socialMs, habitsDone, habitsTarget },
    share: circle.share,
    challenges: circle.challenges,
    myMarks: weekMarks,
    weekDays,
    kudos: circle.kudos.filter(
      (row) => row.fromId === ME && row.dayKey >= oldestDay && !memory.rejected.has(row.id),
    ),
    nudges: circle.nudges.filter(
      (row) => row.fromId === ME && row.dayKey >= oldestDay && !memory.rejected.has(row.id),
    ),
    accountId,
  });
}

/** Whether a sync is allowed to go out at `now`. */
export function canSyncAt(now: number, force: boolean): boolean {
  if (now < memory.notBefore) {
    return false;
  }
  return force || now - memory.lastSyncAt >= SYNC_INTERVAL_MS;
}

/**
 * One trip to the server. Never throws, never blocks a screen, never reverts a local
 * write. Concurrent callers for the same account share the one flight.
 */
export function syncCircle(force = false): Promise<void> {
  const store = useCircleStore.getState();
  const profile = store.profile;
  const account = store.account;
  if (profile === null || account === null || account.id !== profile.id) {
    return Promise.resolve();
  }
  const now = Date.now();
  if (!canSyncAt(now, force)) {
    return Promise.resolve();
  }
  const pending = inFlight.get(account.id);
  if (pending !== undefined) {
    return pending;
  }
  const trip = runSync(account.id).finally(() => {
    inFlight.delete(account.id);
  });
  inFlight.set(account.id, trip);
  return trip;
}

async function runSync(accountId: string): Promise<void> {
  const credentials = await loadCredentials(accountId);
  if (credentials === null) {
    // The key is gone: a restore onto another phone, or a keychain that will not
    // answer. Nothing local changes and the line says it could not sync.
    useCircleStore.getState().markSyncFailed();
    return;
  }
  const at = Date.now();
  const upload = collectUpload(accountId, at);
  const result = await sync(credentials, upload);

  // The account may have been deleted while the server was answering.
  const after = useCircleStore.getState();
  if (after.account === null || after.account.id !== accountId) {
    return;
  }
  if (!result.ok) {
    if (result.failure.kind === 'rateLimited') {
      memory.notBefore = Date.now() + result.failure.retryAfterMs;
    }
    after.markSyncFailed();
    return;
  }

  const download = result.value;
  const folded = foldDownload(download, accountId, {
    members: after.members,
    challenges: after.challenges,
    nudgeIds: new Set(after.nudges.map((nudge) => nudge.id)),
  }, Date.now());

  applyingRemote = true;
  try {
    after.applyRemote(folded);
  } finally {
    applyingRemote = false;
  }
  for (const id of download.rejected) {
    memory.rejected.add(id);
  }
  memory.lastSyncAt = Date.now();
  useCircleStore.getState().markSynced(download.now, memory.lastSyncAt);

  // What `/sync` cannot say, said with the calls that can. Neither is retried here:
  // whatever fails is still true locally and goes out again next time.
  for (const memberId of folded.accepts) {
    await acceptInvite(credentials, memberId);
  }
  for (const challengeId of folded.joins) {
    await joinChallenge(credentials, challengeId);
  }
}

// --- The hook ------------------------------------------------------------------------------

export function useCircleSync(): void {
  useEffect(() => {
    void syncCircle(true);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncCircle(true);
      }
    });

    // Anything the user writes about the circle goes up right away: a cheer, a nudge,
    // an accepted invitation, a challenge. `applyingRemote` is what keeps a download
    // from counting as one of those and asking for the next sync.
    const unsubscribe = useCircleStore.subscribe((state, previous) => {
      if (state.account === null) {
        return;
      }
      if (previous.account === null) {
        // The account was just born: ask for everything, from the cursor at zero.
        void syncCircle(true);
        return;
      }
      if (applyingRemote) {
        return;
      }
      const changed =
        state.kudos !== previous.kudos ||
        state.nudges !== previous.nudges ||
        state.members !== previous.members ||
        state.challenges !== previous.challenges ||
        state.share !== previous.share;
      if (changed) {
        void syncCircle(true);
      }
    });

    const timer = setInterval(() => {
      void syncCircle();
    }, SYNC_INTERVAL_MS);

    return () => {
      appState.remove();
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
}
