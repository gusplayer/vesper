import Constants from 'expo-constants';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  eraseIdentity,
  readIdentity,
  readIdentityPingAt,
  useIdentityStore,
  writeIdentity,
  writeIdentityPingAt,
  type IdentityRecord,
} from '../../data/identity';
import { useAppStore } from '../../data/stores/app';
import { useCircleStore } from '../../data/stores/circle';
import { DAY, SECOND } from '../../domain/time';
import { uuidv7 } from '../../lib/uuid';
import { forgetLastBackup } from '../backup';
import { isAndroid, isIos } from '../capabilities';
import { createIdentity, deleteAccount, putDevice, rotateSecret, type ApiFailure, type Credentials } from '../circleApi';
import {
  clearIdentity,
  forgetIdentityPreparation,
  identityStorageAvailable,
  loadIdentity,
  readStoredCredential,
  saveIdentity,
} from '../identity';

/**
 * The identity without login (ADR-0048 §2, §3), in the shape every platform hook has: a
 * few functions that talk to the outside, a hook that decides when, and a record in the
 * settings table that never knows either exists.
 *
 * **It is born on the first launch, in silence.** The id is reserved here at once — the
 * circle profile's, on a phone that already had one, or a new UUID v7 — and registered
 * with `POST /account { id }` whenever there is a connection. Without one the app is
 * whole and the registration waits for the next time the app comes to the front (rule 7).
 * Nothing here blocks a screen or shows an error.
 *
 * **Except when it finds a previous Vesper.** A key in the keychain (or in the copy that
 * travels) that no identity of this install claims, while the onboarding has not been
 * done, is a new phone or a reinstall. No identity is born then: the welcome screen asks
 * whether to restore it or to start over (`useIdentityStore().found`).
 *
 * **Once a day at most it says it is alive**: `POST /device` with the platform, the
 * version and the time zone, which is everything the server knows of someone who never
 * uses the circle (ADR-0048 §3). The push token is not in that call; the push sync owns
 * it, and a field left out is a field the server keeps.
 *
 * Every step that changes which key this phone holds runs one at a time (`exclusive`): a
 * registration answering in the middle of a restore would otherwise write its fresh
 * secret over the restored one, and that account would be lost for good.
 */

let chain: Promise<unknown> = Promise.resolve();

/** Runs `task` after every identity step already queued, and before any queued after it. */
export function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

/** One settle at a time: mount, foreground and a reset may ask at once. */
let settling: Promise<void> | null = null;

/** Tests and "Borrar todo y reiniciar": forget what this launch already did. */
export function forgetIdentitySync(): void {
  settling = null;
  forgetIdentityPreparation();
  useIdentityStore.setState({ found: null, checked: false });
}

function recordOf(id: string, patch: Partial<IdentityRecord> = {}): IdentityRecord {
  return { id, registeredAt: null, supersedes: null, rotatePending: false, ...patch };
}

// --- Birth ------------------------------------------------------------------------------------

/**
 * The identity of this install, or null when a previous Vesper was found and the user
 * has to decide first. A legacy circle account was already recorded as the identity by
 * platform/identity's migration, which every keychain read waits for.
 */
async function birth(now: number): Promise<IdentityRecord | null> {
  const stored = await readStoredCredential();
  const existing = readIdentity();
  if (existing !== null) {
    return existing;
  }
  const circle = useCircleStore.getState();
  if (stored !== null) {
    if (!useAppStore.getState().settings.onboardingDone) {
      useIdentityStore.getState().setFound({ id: stored.id });
      return null;
    }
    if (stored.id === circle.profile?.id) {
      // A key for this very profile: ADR-0044 created the account and lost only the note
      // of it. The server has the id; this phone has the secret.
      const adopted = recordOf(stored.id, { registeredAt: now });
      writeIdentity(adopted, now);
      return adopted;
    }
    // A key no identity of this install claims, on a phone that already did its
    // onboarding: the key of a profile this phone no longer has. A new identity takes
    // its place when it registers.
  }
  // A profile from before identities keeps its id: the invite code derives from it, and
  // nothing has left the phone yet (it has no account, or the migration recorded one).
  const id = circle.profile !== null && circle.account === null ? circle.profile.id : uuidv7(now);
  const born = recordOf(id);
  writeIdentity(born, now);
  return born;
}

// --- Registration ---------------------------------------------------------------------------

export type IdentityOutcome =
  | { kind: 'ok'; credentials: Credentials }
  /** No identity yet: a previous Vesper is waiting for the user's answer. */
  | { kind: 'none' }
  /** Registered, and this phone has no key for it (a keychain that lost it). */
  | { kind: 'lostKey' }
  /** This build cannot keep a secret, so it must not register one it would lose. */
  | { kind: 'noKeychain' }
  | { kind: 'failed'; failure: ApiFailure };

/**
 * The previous Vesper the user chose to start over from, deleted with its own key before
 * the new identity writes its key over it. A server that cannot be reached keeps it
 * waiting, and the new identity with it: the old key is the only way to ever delete
 * that account.
 */
async function dropSuperseded(record: IdentityRecord, now: number): Promise<IdentityRecord | ApiFailure> {
  if (record.supersedes === null) {
    return record;
  }
  const stored = await readStoredCredential();
  if (stored !== null && stored.id === record.supersedes) {
    const result = await deleteAccount(stored);
    if (!result.ok && result.failure.kind !== 'unauthorized') {
      return result.failure;
    }
    await clearIdentity();
  }
  const next = { ...record, supersedes: null };
  writeIdentity(next, now);
  return next;
}

/** A restore whose rotation could not go out: the old secret is replaced now. */
async function rotateIfPending(record: IdentityRecord, credentials: Credentials, now: number): Promise<Credentials> {
  if (!record.rotatePending) {
    return credentials;
  }
  const rotated = await rotateSecret(credentials);
  if (!rotated.ok) {
    // The old secret still works; the next foreground tries again.
    return credentials;
  }
  // The server already forgot the old secret, so the rotation is over whether or not the
  // keychain takes the new one; a keychain that refuses leaves this call the only one
  // that can sign, and the record must not ask to rotate a secret it never kept.
  await saveIdentity(rotated.value);
  writeIdentity({ ...record, rotatePending: false }, now);
  return rotated.value;
}

async function register(now: number): Promise<IdentityOutcome> {
  let record = readIdentity();
  if (record === null) {
    return { kind: 'none' };
  }
  const dropped = await dropSuperseded(record, now);
  if (!('id' in dropped)) {
    return { kind: 'failed', failure: dropped };
  }
  record = dropped;

  if (record.registeredAt !== null) {
    const credentials = await loadIdentity();
    if (credentials === null) {
      return { kind: 'lostKey' };
    }
    return { kind: 'ok', credentials: await rotateIfPending(record, credentials, now) };
  }

  if (!(await identityStorageAvailable())) {
    return { kind: 'noKeychain' };
  }
  let created = await createIdentity(record.id);
  if (!created.ok && created.failure.kind === 'unauthorized') {
    // The id is already somebody's — or this phone's, from a first answer that never
    // arrived, which comes to the same: nobody can hand its secret out again. A new id.
    const fresh = uuidv7(now);
    useCircleStore.getState().setProfileId(fresh, now);
    record = recordOf(fresh);
    writeIdentity(record, now);
    created = await createIdentity(fresh);
  }
  if (!created.ok) {
    // Offline, or 429 behind a shared address: the id stays reserved and the next
    // foreground tries again. Nothing is shown.
    return { kind: 'failed', failure: created.failure };
  }
  // The key first, the note after (ADR-0044 §1): the other order would leave an identity
  // recorded as registered that this phone can never sign for.
  if (!(await saveIdentity(created.value))) {
    return { kind: 'noKeychain' };
  }
  writeIdentity({ ...record, registeredAt: now }, now);
  return { kind: 'ok', credentials: created.value };
}

/**
 * "Empezar una identidad nueva" (Ajustes › Respaldo), for an identity recorded as
 * registered whose key never reached this phone: an Android system restore brings the
 * database back and, without a screen lock, not the secret (ADR-0048). Nothing here
 * decides that on its own — a keychain that fails one read must not cost anybody their
 * account — so the screen asks, next to "Tengo una clave".
 *
 * The data on this phone stays. A new id is reserved and registered, and the backup goes
 * out again under it. The old account cannot be deleted without its key; a circle it
 * held stays with it, and "Tengo una clave" can still bring both back.
 */
export function startNewIdentity(now: number): Promise<IdentityOutcome> {
  return exclusive(async () => {
    const record = readIdentity();
    if (record !== null && (await loadIdentity()) !== null) {
      // The key is here after all: there is nothing to start over from.
      return register(now);
    }
    const fresh = uuidv7(now);
    const circle = useCircleStore.getState();
    if (circle.profile !== null && circle.account === null) {
      // A profile that never reached the server follows the new id; one that did stays
      // with the old account, where only its key can reach it.
      circle.setProfileId(fresh, now);
    }
    writeIdentity(recordOf(fresh), now);
    forgetLastBackup(now);
    return register(now);
  });
}

/**
 * The identity, registered if it can be. The circle calls this before it claims a
 * profile (ADR-0048 §2: the circle sits on the identity), and the hook calls it on every
 * foreground. Never throws.
 */
export function ensureIdentityRegistered(now: number): Promise<IdentityOutcome> {
  return exclusive(() => register(now));
}

// --- The daily ping -------------------------------------------------------------------------

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** The version in app.json, as the build carries it. Undefined when it cannot be read. */
function appVersion(): string | undefined {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.length > 0 ? version : undefined;
}

/**
 * `POST /device` with the platform, the version and the zone, once a day at most
 * (ADR-0048 §3). A failure is not recorded, so the next foreground tries again.
 */
async function pingIfDue(now: number): Promise<void> {
  const last = readIdentityPingAt();
  if (last !== null && now - last < DAY && now >= last) {
    return;
  }
  const credentials = await loadIdentity();
  if (credentials === null) {
    return;
  }
  const result = await putDevice(credentials, {
    timeZone: timeZone(),
    platform: isIos ? 'ios' : isAndroid ? 'android' : undefined,
    appVersion: appVersion(),
  });
  if (result.ok) {
    writeIdentityPingAt(now);
  }
}

// --- Settling ---------------------------------------------------------------------------------

/**
 * Everything the identity needs at a launch or a foreground: born if it is not, a
 * previous Vesper found if there is one, registered if it can be, and the daily ping.
 */
export function settleIdentity(now: number): Promise<void> {
  if (settling !== null) {
    return settling;
  }
  const run = exclusive(async () => {
    let record: IdentityRecord | null;
    try {
      record = await birth(now);
    } finally {
      // Whatever the keychain answered, or if it threw: the welcome screen stops waiting.
      useIdentityStore.getState().setChecked();
    }
    if (record === null) {
      return;
    }
    const outcome = await register(now);
    if (outcome.kind === 'ok') {
      await pingIfDue(now);
    }
  })
    .catch(() => undefined)
    .finally(() => {
      settling = null;
    });
  settling = run;
  return run;
}

// --- The user's decisions -------------------------------------------------------------------

/**
 * - `deleted`: the previous Vesper is gone from the server, with its backup and circle.
 * - `pending`: no connection; it is deleted with its own key before the new identity
 *   registers (the key stays in the keychain until then, and signs nothing else).
 */
export type StartFreshOutcome = 'deleted' | 'pending';

/**
 * "Empezar de cero" on the welcome screen: the previous Vesper this phone found is
 * deleted on the server — `DELETE /account` with its key, which takes its backup and
 * its circle with it — and a new identity is born. Never blocks the onboarding.
 */
export async function startFresh(now: number): Promise<StartFreshOutcome> {
  const outcome = await exclusive(async (): Promise<StartFreshOutcome> => {
    const stored = await readStoredCredential();
    let supersedes: string | null = null;
    if (stored !== null && stored.id !== readIdentity()?.id) {
      const result = await deleteAccount(stored);
      if (result.ok || result.failure.kind === 'unauthorized') {
        await clearIdentity();
      } else {
        supersedes = stored.id;
      }
    }
    const id = uuidv7(now);
    useCircleStore.getState().setProfileId(id, now);
    writeIdentity(recordOf(id, { supersedes }), now);
    useIdentityStore.getState().setFound(null);
    return supersedes === null ? 'deleted' : 'pending';
  });
  void ensureIdentityRegistered(now);
  return outcome;
}

/**
 * A new identity in place of one that was deleted ("Borrar la cuenta" in Ajustes ›
 * Círculo) or whose key was lost. A new id, not the old one again: the deleted account
 * should not be linkable to the next. The circle's marker must already be gone, so the
 * profile can take the new id.
 */
export async function rebirthIdentity(now: number): Promise<void> {
  await exclusive(async () => {
    await clearIdentity();
    eraseIdentity();
    const id = uuidv7(now);
    useCircleStore.getState().setProfileId(id, now);
    writeIdentity(recordOf(id), now);
  });
  void ensureIdentityRegistered(now);
}

/**
 * - `done`: the account is gone from the server, or there never was one.
 * - `offline`: it could not be reached; the account stays there.
 * - `orphaned`: it was registered and this phone has no key to delete it with.
 */
export type IdentityDeleteOutcome = 'done' | 'offline' | 'orphaned';

/**
 * "Borrar todo y reiniciar": the identity's account goes from the server — its backup
 * and its circle with it — and the key from both copies, whether or not the server
 * answered (the reset never waits on a connection). The caller wipes the database, and
 * `settleIdentity` then gives the phone a new identity.
 */
export function deleteIdentityForReset(): Promise<IdentityDeleteOutcome> {
  return exclusive(async () => {
    const record = readIdentity();
    const credentials = await loadIdentity();
    let outcome: IdentityDeleteOutcome = 'done';
    if (credentials !== null) {
      const result = await deleteAccount(credentials);
      if (!result.ok && result.failure.kind !== 'unauthorized') {
        outcome = 'offline';
      }
    } else if (record !== null && record.registeredAt !== null) {
      outcome = 'orphaned';
    }
    await clearIdentity();
    eraseIdentity();
    return outcome;
  });
}

// --- The hook -------------------------------------------------------------------------------

/**
 * The longest the welcome screen waits for the first look at the keychain. A keychain
 * that never answers must not keep "Empezar" disabled: the app works without an
 * identity (rule 7), and a previous Vesper found later is still offered on the next
 * launch while the onboarding is not done.
 */
const CHECK_TIMEOUT_MS = 3 * SECOND;

export function useIdentitySync(): void {
  useEffect(() => {
    void settleIdentity(Date.now());
    const timer = setTimeout(() => {
      useIdentityStore.getState().setChecked();
    }, CHECK_TIMEOUT_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void settleIdentity(Date.now());
      }
    });
    return () => {
      clearTimeout(timer);
      appState.remove();
    };
  }, []);
}
