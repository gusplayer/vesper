import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data/stores/app';
import { EVERYONE, useCircleStore } from '../../data/stores/circle';
import { sharedWeekUsageMs, useUsageStore } from '../../data/stores/usage';
import { weekDayKeys, weekKeyOf } from '../../domain/circle';
import { dayKeyOf, weekStart } from '../../domain/day';
import { weeklyProgress } from '../../domain/habits';
import { MINUTE } from '../../domain/time';
import { ME } from '../../domain/types';
import { loadCredentials } from '../circle';
import {
  acceptInvite,
  buildUpload,
  claimAccount,
  deleteAccount,
  endLink,
  foldDownload,
  isUuidV7,
  isValidHandle,
  joinChallenge,
  leaveChallenge,
  putAccount,
  redeemInvite,
  sync,
  type ApiFailure,
  type Credentials,
  type RemoteMark,
  type SyncUpload,
} from '../circleApi';
import { ensureIdentityRegistered, rebirthIdentity } from './useIdentitySync';

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
 * **The circle's account is claimed here, and late.** Not when the profile is created —
 * that stays local and offline (rule 7) — but the first time the user needs somebody
 * else to be able to find them: inviting, or using a code (ADR-0044 §2). Since ADR-0048
 * the account itself already exists by then — it is the identity, born on the first
 * launch in useIdentitySync — so claiming is naming it: the name, the handle and the
 * invite code go up with the identity's key. Until then this hook has nothing to do.
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
 * The one account claim in flight. Two at once — the invite screen claiming on mount
 * while the user taps "Compartir" — would be two `POST /account` for one id: the second
 * finds the first's account and answers 401, which reads as a lost key, or both create
 * and the keychain keeps the losing secret. Every caller shares this one.
 */
let claimInFlight: Promise<AccountOutcome> | null = null;

/**
 * True while the store is being filled from a download. A sync fires after a local
 * write; without this flag, writing what the server just sent would ask for another
 * sync, and that one for another.
 */
let applyingRemote = false;

/**
 * True while a restore rebuilds the circle (features/restore). The marker appears in the
 * middle of it, and an ordinary sync then would report this phone's week — the new
 * phone's, empty — over the one the lost phone reported. `restoreCircleSync` is the only
 * trip that goes out meanwhile.
 */
let held = false;

export function holdCircleSync(hold: boolean): void {
  held = hold;
}

/** Forgets the cooldown. "Borrar todo y reiniciar", deleting the account, and tests. */
export function forgetCircleSync(): void {
  memory.lastSyncAt = 0;
  memory.notBefore = 0;
  memory.rejected.clear();
  inFlight.clear();
  claimInFlight = null;
}

// --- The account ----------------------------------------------------------------------

export type AccountOutcome =
  | { kind: 'ok'; credentials: Credentials }
  /** There is no circle profile yet: the flow that creates one has to run first. */
  | { kind: 'noProfile' }
  /** The handle belongs to somebody else. The user picks another one. */
  | { kind: 'handleTaken' }
  /** The handle breaks the server's rule; known here, before any request. */
  | { kind: 'handleInvalid' }
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
export function ensureCircleAccount(now: number): Promise<AccountOutcome> {
  if (claimInFlight !== null) {
    return claimInFlight;
  }
  const flight = createOrLoadAccount(now).finally(() => {
    if (claimInFlight === flight) {
      claimInFlight = null;
    }
  });
  claimInFlight = flight;
  return flight;
}

async function createOrLoadAccount(now: number): Promise<AccountOutcome> {
  const store = useCircleStore.getState();
  if (store.profile === null) {
    return { kind: 'noProfile' };
  }
  if (store.account !== null && store.account.id === store.profile.id) {
    const stored = await loadCredentials(store.profile.id);
    if (stored !== null) {
      return { kind: 'ok', credentials: stored };
    }
  }

  // The circle sits on the identity (ADR-0048 §2): its account exists before the circle
  // needs it, and claiming the profile is naming it — `POST /account` with the key,
  // the name, the handle and the code — not creating a second account.
  const identity = await ensureIdentityRegistered(now);
  switch (identity.kind) {
    case 'ok':
      break;
    case 'noKeychain':
      return { kind: 'noKeychain' };
    case 'failed':
      return { kind: 'failed', failure: identity.failure };
    default:
      // No identity yet, or one whose key this phone lost: only the backup key gets
      // back in (ADR-0044 §3).
      return { kind: 'failed', failure: { kind: 'unauthorized' } };
  }
  const credentials = identity.credentials;
  const before = useCircleStore.getState();
  if (before.profile === null) {
    return { kind: 'noProfile' };
  }
  if (before.account !== null && before.account.id !== credentials.id) {
    // A marker for an account that is not this identity's: nothing can sign for it.
    return { kind: 'failed', failure: { kind: 'unauthorized' } };
  }
  if (before.account !== null) {
    return { kind: 'ok', credentials };
  }
  // A profile made before the identity had its id takes it now: before a claim the id
  // has never left the phone, and the server derives the invite code from it.
  before.setProfileId(credentials.id, now);
  const profile = useCircleStore.getState().profile ?? before.profile;
  if (!isValidHandle(profile.handle)) {
    return { kind: 'handleInvalid' };
  }
  const claimed = await claimAccount(profile, credentials);
  if (!claimed.ok) {
    return claimed.failure.kind === 'handleTaken'
      ? { kind: 'handleTaken' }
      : { kind: 'failed', failure: claimed.failure };
  }
  // The profile may have been deleted while the server was answering.
  const after = useCircleStore.getState();
  if (after.profile === null || after.profile.id !== profile.id) {
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
  // The code the server now holds, and the name it now has, are this profile's.
  useCircleStore.getState().markCodeConfirmed(claimed.value.codeGeneration, now);
  useCircleStore.getState().setProfileDirty(false, now);
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
  // The identity's key exists before the circle's account does (ADR-0048): without the
  // marker, the profile has not been claimed yet, and the ordinary claim does it.
  const credentials = useCircleStore.getState().account === null ? null : await loadCredentials(profile.id);
  if (credentials === null) {
    return ensureCircleAccount(now);
  }
  if (!isValidHandle(profile.handle)) {
    return { kind: 'handleInvalid' };
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
  // The claim carries the name and the handle too: a pending rename just went out.
  useCircleStore.getState().markCodeConfirmed(claimed.value.codeGeneration, now);
  useCircleStore.getState().setProfileDirty(false, now);
  return { kind: 'ok', credentials };
}

/**
 * The code on screen, made real: the account exists and the server holds this very
 * generation. A code generated offline — or one whose claim failed — is bumped here but
 * nobody's there, so it is claimed again before anything shows or shares it.
 */
export async function ensureInviteCode(now: number): Promise<AccountOutcome> {
  const outcome = await ensureCircleAccount(now);
  if (outcome.kind !== 'ok') {
    return outcome;
  }
  const { profile, confirmedGeneration } = useCircleStore.getState();
  if (profile !== null && confirmedGeneration === profile.codeGeneration) {
    return outcome;
  }
  return claimInviteCode(now);
}

/** Whether the code on screen is one the server holds for this account. */
export function inviteCodeConfirmed(state: {
  account: unknown;
  profile: { codeGeneration: number } | null;
  confirmedGeneration: number | null;
}): boolean {
  return (
    state.account !== null && state.profile !== null && state.confirmedGeneration === state.profile.codeGeneration
  );
}

export type RedeemOutcome =
  | 'sent'
  | 'alreadyMember'
  | 'unknownCode'
  | 'ownCode'
  | 'handleTaken'
  | 'handleInvalid'
  | 'noProfile'
  | 'tooMany'
  | 'noKeychain'
  | 'offline'
  | 'lostKey'
  | 'server';

/**
 * A failed call, in the words the line under the field uses. Only a request that never
 * reached the server is "offline": a key the server does not know, a wait it asked for
 * and a refusal are three other facts, and telling any of them to "try again when you
 * have a connection" sends the user back to a wall (rule 8).
 */
function failureOutcome(failure: ApiFailure): RedeemOutcome {
  switch (failure.kind) {
    case 'offline':
      return 'offline';
    case 'rateLimited':
      return 'tooMany';
    case 'unauthorized':
      return 'lostKey';
    default:
      return 'server';
  }
}

function redeemFailure(failure: ApiFailure): RedeemOutcome {
  switch (failure.kind) {
    case 'notFound':
      return 'unknownCode';
    case 'conflict':
      return 'ownCode';
    default:
      return failureOutcome(failure);
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
      case 'handleInvalid':
        return 'handleInvalid';
      case 'noProfile':
        return 'noProfile';
      case 'noKeychain':
        return 'noKeychain';
      case 'failed':
        return failureOutcome(account.failure);
    }
  }
  let result = await redeemInvite(account.credentials, code);
  if (!result.ok && result.failure.kind === 'handleRequired') {
    // The server has the identity but not its circle profile (ADR-0048): name it, with
    // the handle and the code, and ask once more.
    const claimed = await claimInviteCode(now);
    if (claimed.kind === 'handleTaken' || claimed.kind === 'handleInvalid') {
      return claimed.kind;
    }
    if (claimed.kind === 'ok') {
      result = await redeemInvite(claimed.credentials, code);
    }
  }
  if (!result.ok) {
    return redeemFailure(result.failure);
  }
  // The other person's row arrives with the next sync, not with this answer.
  await syncCircle(true);
  return result.value.status === 'member' ? 'alreadyMember' : 'sent';
}

// --- Accepting ------------------------------------------------------------------------------

/**
 * - `accepted`: the server has it; the link is mutual.
 * - `queued`: written here, not there yet; the sync keeps sending it.
 * - `gone`: the server has no such request any more, and the row goes.
 * - `local`: there is no account, so there was nobody to tell (the demo circle).
 */
export type AcceptOutcome = 'accepted' | 'queued' | 'gone' | 'local';

/**
 * One acceptance, sent. `/sync` cannot carry it: a member row only comes back when it
 * changed after the cursor, and the pending row already came down once — which is how
 * it got on screen. So it goes as its own call, now and on every sync until the server
 * answers (the store keeps the list).
 */
async function sendAccept(credentials: Credentials, memberId: string): Promise<AcceptOutcome> {
  const result = await acceptInvite(credentials, memberId);
  const store = useCircleStore.getState();
  if (result.ok) {
    store.settleAccept(memberId, Date.now());
    return 'accepted';
  }
  switch (result.failure.kind) {
    case 'notFound':
      // No request from that person on the server: nothing to be a member of.
      store.settleAccept(memberId, Date.now());
      store.removeMember(memberId);
      return 'gone';
    case 'rejected':
      store.settleAccept(memberId, Date.now());
      return 'gone';
    default:
      return 'queued';
  }
}

/**
 * "Aceptar", past the local write (`acceptInvite` in the circle store, which already
 * queued it). Never throws; a failure leaves it queued for the next sync.
 */
export async function acceptCircleInvite(memberId: string): Promise<AcceptOutcome> {
  const store = useCircleStore.getState();
  if (store.account === null || store.profile === null) {
    return 'local';
  }
  if (!store.pendingAccepts.includes(memberId)) {
    return 'accepted';
  }
  const credentials = await loadCredentials(store.profile.id);
  if (credentials === null) {
    return 'queued';
  }
  const outcome = await sendAccept(credentials, memberId);
  if (outcome === 'accepted') {
    // Their week comes with the next sync: the link changed, so the row comes back.
    void syncCircle(true);
  }
  return outcome;
}

// --- Ending a link, leaving a challenge (ADR-0049) --------------------------------------------

/**
 * - `ended`: the server has it; the other person stops seeing the user.
 * - `queued`: done here, not there yet (no connection); the sync keeps sending it.
 * - `unsupported`: the deployed server predates the call (404). Done here only; the
 *   other person still sees the user's week, and the screen says so. It stays queued,
 *   so the day the server has the call, the end goes out.
 * - `local`: there is no account, so there was nobody to tell.
 */
export type EndOutcome = 'ended' | 'queued' | 'unsupported' | 'local';

function endOutcome(result: { ok: true } | { ok: false; failure: ApiFailure }): EndOutcome | 'settle' {
  if (result.ok) {
    useCircleStore.getState().setLinkEndSupport('yes', Date.now());
    return 'ended';
  }
  switch (result.failure.kind) {
    case 'notFound':
      useCircleStore.getState().setLinkEndSupport('no', Date.now());
      return 'unsupported';
    case 'rejected':
      // A 400: an id no server could hold (the demo seed's). Nothing to send, ever.
      return 'settle';
    default:
      return 'queued';
  }
}

async function sendEnd(credentials: Credentials, target: string): Promise<EndOutcome> {
  if (target !== EVERYONE && !isUuidV7(target)) {
    useCircleStore.getState().settleEnd(target, Date.now());
    return 'local';
  }
  const result = await endLink(credentials, target === EVERYONE ? { everyone: true } : { memberId: target });
  const outcome = endOutcome(result);
  if (outcome === 'ended' || outcome === 'settle') {
    useCircleStore.getState().settleEnd(target, Date.now());
  }
  return outcome === 'settle' ? 'local' : outcome;
}

async function sendLeave(credentials: Credentials, challengeId: string): Promise<EndOutcome> {
  if (!isUuidV7(challengeId)) {
    useCircleStore.getState().settleLeave(challengeId, Date.now());
    return 'local';
  }
  const outcome = endOutcome(await leaveChallenge(credentials, challengeId));
  if (outcome === 'ended' || outcome === 'settle') {
    useCircleStore.getState().settleLeave(challengeId, Date.now());
  }
  return outcome === 'settle' ? 'local' : outcome;
}

/**
 * Rechazar, Quitar, Salir del círculo — past the local write, which already queued the
 * end (`declineInvite`, `removeFromCircle`, `leaveCircle` in the circle store). `target`
 * is a member id, or `EVERYONE`. Never throws.
 */
export async function endCircleLink(target: string): Promise<EndOutcome> {
  const store = useCircleStore.getState();
  if (store.account === null || store.profile === null) {
    return 'local';
  }
  if (!store.pendingEnds.includes(target)) {
    return 'ended';
  }
  const credentials = await loadCredentials(store.profile.id);
  if (credentials === null) {
    return 'queued';
  }
  return sendEnd(credentials, target);
}

/** Salir del círculo, past the local write (`leaveCircle` in the store): every link at once. */
export function endEveryLink(): Promise<EndOutcome> {
  return endCircleLink(EVERYONE);
}

/** Salir del reto, past the local write (`leaveChallenge` in the store). Never throws. */
export async function leaveCircleChallenge(challengeId: string): Promise<EndOutcome> {
  const store = useCircleStore.getState();
  if (store.account === null || store.profile === null) {
    return 'local';
  }
  if (!store.pendingLeaves.includes(challengeId)) {
    return 'ended';
  }
  const credentials = await loadCredentials(store.profile.id);
  if (credentials === null) {
    return 'queued';
  }
  return sendLeave(credentials, challengeId);
}

// --- Renaming ------------------------------------------------------------------------------

/** `saved` reached the server (or there is no account); `pending` is saved here only. */
export type RenameOutcome = 'saved' | 'pending' | 'handleTaken';

/**
 * Ajustes › Círculo › Guardar, once there is an account. The name and the handle are the
 * server's to show, so they go up with the same `POST /account` that made the account,
 * without an invite code (the stored one stays). A taken handle is refused before the
 * local write, so the phone never shows a handle the circle does not see; without a
 * connection the rename is saved here and goes out with the next sync.
 */
export async function renameCircleAccount(
  input: { name: string; handle: string },
  now: number,
): Promise<RenameOutcome> {
  const store = useCircleStore.getState();
  const profile = store.profile;
  if (profile === null || store.account === null) {
    store.updateProfile(input, now);
    return 'saved';
  }
  const credentials = await loadCredentials(profile.id);
  if (credentials === null) {
    store.updateProfile(input, now);
    store.setProfileDirty(true, now);
    return 'pending';
  }
  const result = await putAccount({ id: profile.id, name: input.name.trim(), handle: input.handle }, credentials);
  if (!result.ok && result.failure.kind === 'handleTaken') {
    return 'handleTaken';
  }
  const after = useCircleStore.getState();
  after.updateProfile(input, now);
  after.setProfileDirty(!result.ok, now);
  return result.ok ? 'saved' : 'pending';
}

/** A rename that could not go out when it was saved, sent again from the sync. */
async function sendPendingRename(credentials: Credentials): Promise<void> {
  const profile = useCircleStore.getState().profile;
  if (profile === null) {
    return;
  }
  const result = await putAccount({ id: profile.id, name: profile.name, handle: profile.handle }, credentials);
  // A handle taken meanwhile is not retried every five minutes: the next claim of the
  // invite code carries the handle again and says so where the user can fix it.
  if (result.ok || result.failure.kind === 'handleTaken' || result.failure.kind === 'rejected') {
    useCircleStore.getState().setProfileDirty(false, Date.now());
  }
}

// --- Deleting ------------------------------------------------------------------------------

/**
 * - `done`: gone from the server and from here.
 * - `offline`: the server could not be reached; nothing was cleared.
 * - `orphaned`: this phone had no key, so the account is cleared here and **stays on
 *   the server**, where nobody can delete it any more. Saying "try again" would be a lie.
 */
export type DeleteOutcome = 'done' | 'offline' | 'orphaned';

/**
 * "Borrar la cuenta" (ADR-0044 §7), which is not "Salir del círculo": the account and
 * every row of it go from the server, the key goes from the keychain, and the app is
 * local again and still whole. Nothing is cleared when the server could not be reached,
 * because a key deleted here with the account still up there is an account nobody can
 * ever delete.
 *
 * Since ADR-0048 that account is the identity, so its encrypted backup goes with it,
 * and the phone gets a new identity — a new id, unlinkable to the deleted one — that
 * registers and backs up again on its own. The profile stays here and takes the new id.
 */
export async function deleteCircleAccountOutcome(now: number): Promise<DeleteOutcome> {
  const store = useCircleStore.getState();
  const profile = store.profile;
  if (profile === null || store.account === null) {
    return 'done';
  }
  const credentials = await loadCredentials(profile.id);
  if (credentials === null) {
    // There is an account but this phone lost its key, so the DELETE cannot be sent
    // and nobody will ever be able to send it. Clearing up locally is all that is left.
    useCircleStore.getState().clearAccount(now);
    forgetCircleSync();
    await rebirthIdentity(now);
    return 'orphaned';
  }
  const result = await deleteAccount(credentials);
  // A 401 means the server does not know this key: the account is already gone as
  // far as this phone is concerned, so clearing up is the honest end.
  if (!result.ok && result.failure.kind !== 'unauthorized') {
    return 'offline';
  }
  useCircleStore.getState().clearAccount(now);
  forgetCircleSync();
  await rebirthIdentity(now);
  return 'done';
}

/** The same, as "did it leave the server": what "Borrar todo y reiniciar" asks. */
export async function deleteCircleAccount(now: number): Promise<boolean> {
  return (await deleteCircleAccountOutcome(now)) === 'done';
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
  if (held || profile === null || account === null || account.id !== profile.id) {
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
  const trip = runSync(account.id)
    .then(() => undefined)
    .finally(() => {
      inFlight.delete(account.id);
    });
  inFlight.set(account.id, trip);
  return trip;
}

/**
 * The first sync after restoring with the backup key (ADR-0048 §6): from the cursor at
 * zero, with `restore: true`, so the answer also carries the user's own marks in their
 * challenges. It waits for a sync already in flight and ignores the five-minute floor.
 * Null when it could not reach the server; the caller says so.
 *
 * Nothing goes up with it. The week this phone would report is the new phone's — a
 * restore without a backup has no sessions at all — and sending it would write an empty
 * week over the one the lost phone reported. The next ordinary sync, after the marks are
 * folded into the habits, reports what is true.
 */
export async function restoreCircleSync(): Promise<RemoteMark[] | null> {
  const { profile, account } = useCircleStore.getState();
  if (profile === null || account === null || account.id !== profile.id) {
    return null;
  }
  const pending = inFlight.get(account.id);
  if (pending !== undefined) {
    await pending;
  }
  const trip = runSync(account.id, true);
  const shared = trip.then(() => undefined);
  inFlight.set(account.id, shared);
  try {
    return await trip;
  } finally {
    if (inFlight.get(account.id) === shared) {
      inFlight.delete(account.id);
    }
  }
}

/** The user's own marks when `restore` asked for them; an empty list otherwise; null on failure. */
async function runSync(accountId: string, restore = false): Promise<RemoteMark[] | null> {
  const credentials = await loadCredentials(accountId);
  if (credentials === null) {
    // The key is gone: a restore onto another phone, or a keychain that will not
    // answer. Nothing local changes and the line says it could not sync.
    useCircleStore.getState().markSyncFailed();
    return null;
  }
  // What this phone ended goes first, so the answer to this very sync already leaves
  // those people out (ADR-0049). A server that predates the call keeps them queued.
  for (const target of [...useCircleStore.getState().pendingEnds]) {
    await sendEnd(credentials, target);
  }
  for (const challengeId of [...useCircleStore.getState().pendingLeaves]) {
    await sendLeave(credentials, challengeId);
  }

  const at = Date.now();
  const upload: SyncUpload = restore
    ? { since: useCircleStore.getState().syncSince, weeks: [], challenges: [], marks: [], kudos: [], nudges: [] }
    : collectUpload(accountId, at);
  const result = await sync(credentials, upload, { restore });

  // The account may have been deleted while the server was answering.
  const after = useCircleStore.getState();
  if (after.account === null || after.account.id !== accountId) {
    return null;
  }
  if (!result.ok) {
    if (result.failure.kind === 'rateLimited') {
      memory.notBefore = Date.now() + result.failure.retryAfterMs;
    }
    after.markSyncFailed();
    return null;
  }

  const download = result.value;
  const folded = foldDownload(download, accountId, {
    members: after.members,
    challenges: after.challenges,
    nudgeIds: new Set(after.nudges.map((nudge) => nudge.id)),
    endedHere: {
      people: new Set(after.pendingEnds.filter((target) => target !== EVERYONE)),
      everyone: after.pendingEnds.includes(EVERYONE),
      challenges: new Set(after.pendingLeaves),
    },
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

  // What `/sync` cannot say, said with the calls that can: every acceptance still
  // queued (plus any the download itself shows as unanswered), the challenges joined
  // offline, and a rename saved without a connection. Whatever fails is still true
  // locally and goes out again next time.
  const accepts = new Set([...folded.accepts, ...useCircleStore.getState().pendingAccepts]);
  for (const memberId of accepts) {
    await sendAccept(credentials, memberId);
  }
  for (const challengeId of folded.joins) {
    await joinChallenge(credentials, challengeId);
  }
  if (useCircleStore.getState().profileDirty) {
    await sendPendingRename(credentials);
  }
  return download.ownMarks;
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
