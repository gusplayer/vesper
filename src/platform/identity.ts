import type { IdentityTransport, VesperIdentityApi } from '../../modules/vesper-identity';
import { readIdentity, writeIdentity } from '../data/identity';
import { useAppStore } from '../data/stores/app';
import { useCircleStore } from '../data/stores/circle';
import { getStrings } from '../i18n';
import { backupKeyOf, credentialsFrom, type Credentials } from './circleApi';

/**
 * Where the identity's secret lives (ADR-0048 §4): the keychain of this phone, and a
 * copy the operating system carries to the next one by itself.
 *
 * - **The local copy** is `expo-secure-store`: the Keychain on iOS, encrypted
 *   preferences on Android. It is what this phone signs with, and it is read first.
 * - **The copy that travels** is `modules/vesper-identity`: one synchronizable Keychain
 *   item on iOS (iCloud Keychain) and Block Store on Android. A new phone on the same
 *   Apple or Google account finds it without the user doing anything.
 *
 * Both are written on every save, except for an identity that must not travel ("Empezar
 * aparte", ADR-0050 §9): that one lives in the local copy only, and the copy that
 * travels keeps the other device's. A clear takes the local copy, and the one that
 * travels only when it holds the very key being dropped: another device's key there is
 * not this phone's to delete. Reading the local copy first is what keeps two phones of
 * one person apart: the copy that travels is one slot, and the last phone to write it
 * wins there, but each phone goes on signing with its own. Without the native module
 * (Expo Go, an older build) the local copy works alone.
 *
 * The secret never goes to SQLite (ADR-0044 §1) and is never logged: a bearer token in
 * a console line is the same leak by another road.
 */

/**
 * The entry ADR-0044 wrote, `<id>.<secret>` under the circle's name. Read once, moved
 * into the identity, then deleted.
 */
const LEGACY_KEY = 'vesper.circle.credentials';

/** The local copy. SecureStore keys allow letters, digits, `.`, `-` and `_`. */
const LOCAL_KEY = 'vesper.identity.credentials';

type SecureStoreModule = typeof import('expo-secure-store');

/** Undefined until the first load; null when the module cannot be used here. */
let secureCached: SecureStoreModule | null | undefined;

function secureStore(): SecureStoreModule | null {
  if (secureCached !== undefined) {
    return secureCached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: absent under vitest
    secureCached = require('expo-secure-store') as SecureStoreModule;
  } catch {
    secureCached = null;
  }
  return secureCached;
}

let nativeCached: VesperIdentityApi | null | undefined;

function native(): VesperIdentityApi | null {
  if (nativeCached !== undefined) {
    return nativeCached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: not in every build
    const mod = require('../../modules/vesper-identity') as typeof import('../../modules/vesper-identity');
    nativeCached = mod.identityModule();
  } catch {
    nativeCached = null;
  }
  return nativeCached;
}

/**
 * `AFTER_FIRST_UNLOCK` rather than the default `WHEN_UNLOCKED`: the syncs run from the
 * background, and a locked phone would otherwise answer with nothing and look like a
 * lost identity. No `requireAuthentication`: Face ID in front of a background sync is a
 * sync that never happens.
 */
function options(store: SecureStoreModule): import('expo-secure-store').SecureStoreOptions {
  return { keychainAccessible: store.AFTER_FIRST_UNLOCK };
}

async function readSecure(key: string): Promise<string | null> {
  const store = secureStore();
  if (store === null) {
    return null;
  }
  try {
    return await store.getItemAsync(key, options(store));
  } catch {
    return null;
  }
}

async function writeSecure(key: string, value: string): Promise<boolean> {
  const store = secureStore();
  if (store === null) {
    return false;
  }
  try {
    await store.setItemAsync(key, value, options(store));
    return true;
  } catch {
    return false;
  }
}

async function deleteSecure(key: string): Promise<void> {
  const store = secureStore();
  if (store === null) {
    return;
  }
  try {
    await store.deleteItemAsync(key, options(store));
  } catch {
    // A keychain that will not delete is not a reason to fail a screen.
  }
}

/** Both copies, the local one first. False only when neither could be written. */
async function writeBoth(credentials: Credentials): Promise<boolean> {
  const value = backupKeyOf(credentials);
  const local = await writeSecure(LOCAL_KEY, value);
  const travelling = (await native()?.setCredential(value)) ?? false;
  return local || travelling;
}

async function readLocal(): Promise<Credentials | null> {
  const local = await readSecure(LOCAL_KEY);
  return local === null ? null : credentialsFrom(local);
}

async function readTravelling(): Promise<Credentials | null> {
  const travelling = await native()?.getCredential();
  return travelling === null || travelling === undefined ? null : credentialsFrom(travelling);
}

function sameKey(a: Credentials | null, b: Credentials | null): boolean {
  return a !== null && b !== null && a.id === b.id && a.secret === b.secret;
}

// --- The entry ADR-0044 left behind ---------------------------------------------------------

let prepared: Promise<void> | null = null;

/**
 * Runs once per launch, before any read: moves the circle's old entry into the identity
 * and, on a phone that had a circle account before identities existed, records that
 * account as the identity (ADR-0048 §2: the account "sube de rango").
 *
 * The old entry moves only when it is this phone's — its id is the circle account's or
 * the profile's — or when this install is new and has no identity yet, which is a
 * reinstall finding its previous Vesper. Anything else is the key of a profile this
 * phone no longer has, which ADR-0044 already refused to sign with; it is deleted
 * rather than carried to other phones.
 */
function prepare(): Promise<void> {
  if (prepared === null) {
    prepared = migrateLegacy().catch(() => undefined);
  }
  return prepared;
}

async function migrateLegacy(): Promise<void> {
  const circle = useCircleStore.getState();
  const legacy = await readSecure(LEGACY_KEY);
  if (legacy !== null) {
    const credentials = credentialsFrom(legacy);
    const record = readIdentity();
    const onboardingDone = useAppStore.getState().settings.onboardingDone;
    const mine =
      credentials !== null && (credentials.id === circle.account?.id || credentials.id === circle.profile?.id);
    const previous = credentials !== null && record === null && !onboardingDone;
    if (credentials !== null && (mine || previous)) {
      if (!(await writeBoth(credentials))) {
        // Nowhere to put it: leave the old entry where it is and try again next launch.
        return;
      }
    }
    await deleteSecure(LEGACY_KEY);
  }
  // A circle account from before identities is the identity: same id, already known to
  // the server. Recorded here so no caller ever sees it as a phone without one.
  if (readIdentity() === null && circle.account !== null) {
    const at = circle.account.createdAt > 0 ? circle.account.createdAt : Date.now();
    writeIdentity(
      { id: circle.account.id, registeredAt: at, supersedes: null, rotatePending: false, localOnly: false },
      Date.now(),
    );
  }
}

/** Forgets that the migration ran: "Borrar todo y reiniciar", and tests. */
export function forgetIdentityPreparation(): void {
  prepared = null;
}

// --- The contract ---------------------------------------------------------------------------

/**
 * Whatever key this phone holds, local copy first, whether or not an identity of this
 * install claims it. The welcome screen's "previous Vesper", the restore, and the
 * delete of an identity this phone chose to leave behind read this; nothing signs a
 * request with it on its own.
 */
export async function readStoredCredential(): Promise<Credentials | null> {
  await prepare();
  return (await readLocal()) ?? (await readTravelling());
}

/**
 * This install's credentials, or null. Only a key whose id is the identity's own is
 * returned: a key found from a previous Vesper, or from another phone of the same
 * person, never signs a request (or a backup) for this one until the user restores it.
 */
export async function loadIdentity(): Promise<Credentials | null> {
  const stored = await readStoredCredential();
  const record = readIdentity();
  return stored !== null && record !== null && stored.id === record.id ? stored : null;
}

/**
 * Both copies. False when neither could be written: the caller must not then record the
 * identity as registered, because a phone convinced it has an account it can never sign
 * for is worse than one without (ADR-0044 §1).
 *
 * `travels: false` is an identity of this device alone ("Empezar aparte", ADR-0050 §9):
 * only the local copy is written, so the copy that travels keeps the other device's key,
 * and false then means the local copy refused.
 */
export async function saveIdentity(credentials: Credentials, options: { travels?: boolean } = {}): Promise<boolean> {
  await prepare();
  if (options.travels === false) {
    return writeSecure(LOCAL_KEY, backupKeyOf(credentials));
  }
  return writeBoth(credentials);
}

/**
 * Forgets a key. Never throws.
 *
 * - Nothing given: both copies, whatever they hold, and the old entry.
 * - A key: the local copy and the old entry, and the copy that travels only when it holds
 *   that very key. Anything else there was written by another device of the same person
 *   — its own identity, or this one's after "Traerlo aquí" moved it there — and deleting
 *   it would take that device's way back to a new phone.
 * - Null (a key this phone never had): the local copy and the old entry only.
 */
export async function clearIdentity(dropped?: Credentials | null): Promise<void> {
  const travelling = dropped === undefined || dropped === null ? null : await readTravelling();
  await deleteSecure(LOCAL_KEY);
  await deleteSecure(LEGACY_KEY);
  if (dropped === undefined || sameKey(travelling, dropped)) {
    await native()?.clearCredential();
  }
}

/**
 * Whether the copy that travels holds a key this phone did not write: another device's
 * identity, or this identity after another device took it over with a new secret
 * (ADR-0050 §10). A new identity started here must not write over it, so it stays local.
 */
export async function travellingCopyIsAnothers(): Promise<boolean> {
  await prepare();
  const travelling = await readTravelling();
  return travelling !== null && !sameKey(travelling, await readLocal());
}

/** Whether this build can keep a secret at all. False in Expo Go and on the web. */
export async function identityStorageAvailable(): Promise<boolean> {
  const store = secureStore();
  if (store !== null) {
    try {
      if (await store.isAvailableAsync()) {
        return true;
      }
    } catch {
      // Falls through to the native module.
    }
  }
  return native() !== null;
}

export type IdentityTravelStatus = {
  /** The key reaches a new phone on the same Apple or Google account by itself. */
  travels: boolean;
  /** And nobody but the user can read it on the way. */
  endToEnd: boolean;
  /** One line for the screen, in the current language (rule 8). */
  reason: string;
};

const NOT_TRAVELLING: IdentityTransport = { travels: false, endToEnd: false, reason: 'unavailable' };

/**
 * Whether the identity travels by itself, said in words (rule 8, ADR-0017): a phone
 * without iCloud Keychain or Play services has only the backup key, and the screen
 * that shows it says so instead of implying the automatic path exists.
 */
export async function identityTravels(): Promise<IdentityTravelStatus> {
  const t = getStrings().identity.travel;
  let localOnly = false;
  try {
    localOnly = readIdentity()?.localOnly === true;
  } catch {
    localOnly = false;
  }
  if (localOnly) {
    // Whatever the transport could do, this key is not in it (ADR-0050 §9).
    return { travels: false, endToEnd: false, reason: t.localOnly };
  }
  const module = native();
  const transport = module === null ? NOT_TRAVELLING : await module.describe();
  const reason = {
    'icloud-keychain': t.icloudKeychain,
    'block-store': t.blockStore,
    'block-store-no-screen-lock': t.blockStoreNoScreenLock,
    unavailable: t.unavailable,
  }[transport.reason];
  return { travels: transport.travels, endToEnd: transport.endToEnd, reason };
}
