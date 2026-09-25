import { DEMO_CHALLENGE_ID, DEMO_MEMBER_IDS } from '../data/circleSeed';
import { useCircleStore } from '../data/stores/circle';
import { getLocaleTag, getStrings } from '../i18n';
import type { Credentials } from './circleApi';
import { clearIdentity, identityStorageAvailable, loadIdentity, saveIdentity } from './identity';

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
 * account it says when the circle connects (and that the people are samples while the
 * demo seed is there); with one it says when it last reached the server, and when it
 * could not.
 */

// --- The keychain ----------------------------------------------------------------------

/**
 * Since ADR-0048 the circle's account is the identity's, and so is its key: these four
 * are the circle's names for platform/identity, kept so every circle call reads the
 * same key the identity registered. The old entry this file wrote
 * (`vesper.circle.credentials`) is moved there once by the identity's migration.
 */

/**
 * The credentials of `profileId`, or null. The identity's key is only returned when
 * its id is this profile's: a key that belongs to another id (a reset, a restore, a
 * previous Vesper found on a new phone) never signs a circle request.
 */
export async function loadCredentials(profileId: string): Promise<Credentials | null> {
  const credentials = await loadIdentity();
  return credentials !== null && credentials.id === profileId ? credentials : null;
}

/** False when the keychain refused; the caller must not then claim there is an account. */
export async function saveCredentials(credentials: Credentials): Promise<boolean> {
  return saveIdentity(credentials);
}

/** Both copies of the key. Never throws. */
export async function clearCredentials(): Promise<void> {
  await clearIdentity();
}

/** Whether this build can keep a secret at all. False in Expo Go and on the web. */
export async function keychainAvailable(): Promise<boolean> {
  return identityStorageAvailable();
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

/**
 * Whether what the circle screens show is the demo seed: any of its people, or its
 * challenge still running. The seed stands in only until an account exists (ADR-0044),
 * so the line under a demo circle says so instead of speaking of a sync.
 */
export function isDemoCircle(state: {
  members: readonly { id: string }[];
  challenges: readonly { id: string; archivedAt: number | null }[];
}): boolean {
  const demoIds: readonly string[] = DEMO_MEMBER_IDS;
  return (
    state.members.some((member) => demoIds.includes(member.id)) ||
    state.challenges.some((challenge) => challenge.id === DEMO_CHALLENGE_ID && challenge.archivedAt === null)
  );
}

/** The values `status()` looks at. A screen passes the ones it subscribed to. */
export type CircleSyncFacts = {
  account: { id: string } | null;
  syncedAt: number | null;
  syncFailed: boolean;
  /** The demo seed is on screen (`isDemoCircle`). Only read while there is no account. */
  demo?: boolean;
};

function currentFacts(): CircleSyncFacts {
  const state = useCircleStore.getState();
  return {
    account: state.account,
    syncedAt: state.syncedAt,
    syncFailed: state.syncFailed,
    demo: isDemoCircle(state),
  };
}

/**
 * Where the circle stands. Called with nothing it reads the store once, which is what
 * a screen that only shows the line wants; a screen that has to re-render when a sync
 * lands passes the values it subscribed to instead.
 *
 * Without an account nothing has left this phone and nothing has arrived: the line says
 * when the circle connects, and that the people are samples while the seed is on
 * screen. With an account,
 * a failure is reported next to the last time it worked — never as a modal, never
 * blocking a screen (ADR-0044 §5).
 */
export function status(facts: CircleSyncFacts = currentFacts()): CircleSyncStatus {
  const t = getStrings().circle.sync;
  const { account, syncedAt, syncFailed } = facts;
  if (account === null) {
    return { available: false, reason: facts.demo === true ? t.demo : t.unavailable, syncedAt: null };
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
