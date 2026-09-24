import { useCircleStore } from '../data/stores/circle';
import { getLocaleTag, getStrings } from '../i18n';
import { backupKeyOf, credentialsFrom, type Credentials } from './circleApi';

/**
 * The circle's half of the platform layer (ADR-0044): where the account's secret lives
 * and what `status()` is allowed to claim.
 *
 * Two rules hold this file together.
 *
 * **The secret lives in the keychain, never in SQLite.** `expo-secure-store` is the
 * Keychain on iOS and EncryptedSharedPreferences on Android. A secret in the database
 * would be emptied by "Borrar todo y reiniciar" and copied out by an unencrypted
 * backup, which makes it not a secret (ADR-0044 §1). The database keeps the id and the
 * cursor; this keeps the secret. It is never logged: a bearer token in a console line
 * is the same leak by another road.
 *
 * **`status()` says what is true and nothing else** (rule 8, ADR-0017). Without an
 * account the circle is still the demo seed and says so; with one it says when it last
 * reached the server, and when it could not.
 */

/**
 * One entry holds the whole bearer token, `<id>.<secret>`, which is also exactly what
 * the backup key is. Keeping the id next to the secret is what lets the app notice
 * that the credentials belong to a profile that no longer exists — after "Borrar todo
 * y reiniciar", say — instead of signing requests as a stranger.
 *
 * SecureStore keys allow letters, digits, `.`, `-` and `_`.
 */
const CREDENTIALS_KEY = 'vesper.circle.credentials';

type SecureStoreModule = typeof import('expo-secure-store');

/** Undefined until the first load; null when the module cannot be used here. */
let cached: SecureStoreModule | null | undefined;

function secureStore(): SecureStoreModule | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: absent under vitest
    cached = require('expo-secure-store') as SecureStoreModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Options for every read and write. `AFTER_FIRST_UNLOCK` rather than the default
 * `WHEN_UNLOCKED`: the sync runs from the background — and, once ADR-0037's push half
 * lands, from a silent notification — and a locked phone would otherwise answer with
 * nothing and look like a lost account. No `requireAuthentication`: Face ID in front
 * of a background sync is a sync that never happens.
 */
function options(store: SecureStoreModule): import('expo-secure-store').SecureStoreOptions {
  return { keychainAccessible: store.AFTER_FIRST_UNLOCK };
}

// --- The keychain ----------------------------------------------------------------------

/**
 * The credentials of `profileId`, or null. Credentials stored under another id belong
 * to a profile this phone no longer has (a reset, a restore): they are not this
 * account's and are not used, so a request is never signed as somebody else.
 */
export async function loadCredentials(profileId: string): Promise<Credentials | null> {
  const store = secureStore();
  if (store === null) {
    return null;
  }
  try {
    const raw = await store.getItemAsync(CREDENTIALS_KEY, options(store));
    if (raw === null) {
      return null;
    }
    const credentials = credentialsFrom(raw);
    return credentials !== null && credentials.id === profileId ? credentials : null;
  } catch {
    return null;
  }
}

/** False when the keychain refused; the caller must not then claim there is an account. */
export async function saveCredentials(credentials: Credentials): Promise<boolean> {
  const store = secureStore();
  if (store === null) {
    return false;
  }
  try {
    await store.setItemAsync(CREDENTIALS_KEY, backupKeyOf(credentials), options(store));
    return true;
  } catch {
    return false;
  }
}

/** Deleting the account, and anything that finds the entry orphaned. Never throws. */
export async function clearCredentials(): Promise<void> {
  const store = secureStore();
  if (store === null) {
    return;
  }
  try {
    await store.deleteItemAsync(CREDENTIALS_KEY, options(store));
  } catch {
    // A keychain that will not delete is not a reason to fail the screen: the entry
    // is useless once the account is gone from the server.
  }
}

/** Whether this build can keep a secret at all. False in Expo Go and on the web. */
export async function keychainAvailable(): Promise<boolean> {
  const store = secureStore();
  if (store === null) {
    return false;
  }
  try {
    return await store.isAvailableAsync();
  } catch {
    return false;
  }
}

// --- What the screens are told ------------------------------------------------------------

export type CircleSyncStatus = {
  /** True once this phone has an account: the rows are other people's, not the seed. */
  available: boolean;
  /** One line for the screen, always true and always in the current language. */
  reason: string;
  /** When the server was last reached, epoch ms. Null while it never has been. */
  syncedAt: number | null;
};

/** The short local date and time of an instant, in the app's language (ADR-0020). */
function whenText(at: number): string {
  return new Intl.DateTimeFormat(getLocaleTag(), {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(at));
}

/** The three values `status()` looks at. A screen passes the ones it subscribed to. */
export type CircleSyncFacts = {
  account: { id: string } | null;
  syncedAt: number | null;
  syncFailed: boolean;
};

/**
 * Where the circle stands. Called with nothing it reads the store once, which is what
 * a screen that only shows the line wants; a screen that has to re-render when a sync
 * lands passes the values it subscribed to instead.
 *
 * Without an account nothing has left this phone and nothing has arrived: the circle
 * is the demo seed, and the line says so, as it has since ADR-0021. With an account,
 * a failure is reported next to the last time it worked — never as a modal, never
 * blocking a screen (ADR-0044 §5).
 */
export function status(facts: CircleSyncFacts = useCircleStore.getState()): CircleSyncStatus {
  const t = getStrings().circle.sync;
  const { account, syncedAt, syncFailed } = facts;
  if (account === null) {
    return { available: false, reason: t.unavailable, syncedAt: null };
  }
  if (syncFailed) {
    return {
      available: true,
      reason: syncedAt === null ? t.failedNever : t.failed(whenText(syncedAt)),
      syncedAt,
    };
  }
  return {
    available: true,
    reason: syncedAt === null ? t.pending : t.synced(whenText(syncedAt)),
    syncedAt,
  };
}
