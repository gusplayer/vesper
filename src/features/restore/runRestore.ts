import { useAppStore, useCircleStore } from '../../data';
import { readIdentity, useIdentityStore, writeIdentity } from '../../data/identity';
import { backupNow, restoreBackup } from '../../platform/backup';
import {
  deleteAccount,
  getAccount,
  rotateSecret,
  type Credentials,
  type RemoteAccount,
} from '../../platform/circleApi';
import { holdCircleSync, restoreCircleSync, syncCircle } from '../../platform/hooks/useCircleSync';
import { exclusive } from '../../platform/hooks/useIdentitySync';
import { identityStorageAvailable, readStoredCredential, saveIdentity } from '../../platform/identity';
import {
  accountFailureResult,
  afterBackup,
  challengesToRejoin,
  finalResult,
  marksToRestore,
  mergeProfile,
  type RestoreResult,
} from './restorePlan';

/**
 * A restore with the backup key (ADR-0048 §5–§7), in the only order that cannot lose
 * anything:
 *
 * 1. `GET /account` proves the key works — before anything on this phone changes.
 * 2. The backup is downloaded and opened with that key (src/platform/backup.ts). It
 *    was sealed with the old secret, so this has to happen before the secret changes;
 *    a newer backup or a failed download ends the restore here, with nothing rotated.
 * 3. `POST /account/secret`: a new secret, and the phone that was lost or sold is shut
 *    out. The new key is written to both copies before the identity is recorded.
 * 4. The identity this install had before, if any, leaves the server: this phone is
 *    the restored Vesper now.
 * 5. The circle comes back from the server: the profile, the marker, the cursor at zero,
 *    a sync with `restore: true`, and the user's own challenge marks folded into their
 *    habits — recreating a challenge's habit where rule 4 leaves room.
 * 6. The backup goes up again under the new key.
 *
 * It runs as one identity step (`exclusive`), so a registration or a start-over cannot
 * write a key in the middle of it. Never throws.
 */
export function runRestore(target: Credentials, now: number): Promise<RestoreResult> {
  return exclusive(async () => {
    holdCircleSync(true);
    try {
      return await restore(target, now);
    } finally {
      holdCircleSync(false);
    }
  })
    .then((result) => {
      // The week, with the restored marks in it, goes up with the ordinary sync.
      void syncCircle(true);
      return result;
    })
    .catch((): RestoreResult => 'failed');
}

async function restore(target: Credentials, now: number): Promise<RestoreResult> {
  if (!(await identityStorageAvailable())) {
    return 'noKeychain';
  }
  const account = await getAccount(target);
  if (!account.ok) {
    return accountFailureResult(account.failure);
  }

  // This install's own identity, if it had one registered with another id: it is left
  // behind once the restore holds, and deleted then. A key found on the phone that no
  // identity of this install claims (another phone of the same person) is not touched.
  const before = readIdentity();
  const stored = await readStoredCredential();
  const leftBehind =
    before !== null && stored !== null && stored.id === before.id && stored.id !== target.id ? stored : null;

  const backup = afterBackup(await restoreBackup(target, now));
  if ('stop' in backup) {
    return backup.stop;
  }

  // A rotation that cannot go out now is not a reason to fail a restore whose backup is
  // already on the phone: the old key is kept and the identity sync rotates it later.
  const rotated = await rotateSecret(target);
  const credentials = rotated.ok ? rotated.value : target;
  if (!(await saveIdentity(credentials))) {
    return 'noKeychain';
  }
  writeIdentity(
    { id: target.id, registeredAt: now, supersedes: null, rotatePending: !rotated.ok },
    now,
  );
  useIdentityStore.getState().setFound(null);

  if (leftBehind !== null) {
    // Best effort: an empty identity from this onboarding, or the one this phone had.
    await deleteAccount(leftBehind);
  }

  const circle = await restoreCircle(account.value, now);

  if (rotated.ok) {
    await backupNow(credentials, now);
  }
  return finalResult(backup.go, circle);
}

/**
 * The circle, as the server has it. False when the account never had one: a handle is
 * what a circle profile is, and an identity without one was never in a circle.
 *
 * Links that ended stay ended: the sync from zero only brings the links the server
 * still has, its `ended` list takes out the rest, and the ends this phone queued before
 * (ADR-0049) are sent before anything is downloaded.
 */
async function restoreCircle(account: RemoteAccount, now: number): Promise<boolean> {
  const store = useCircleStore.getState();
  if (store.account !== null && store.account.id !== account.id) {
    // The circle this install had under its previous identity: that account is gone.
    store.clearAccount(now);
  }
  const merged = mergeProfile(useCircleStore.getState().profile, account, now);
  if (merged === null) {
    // No circle on the server. A profile made here and never claimed takes the id.
    useCircleStore.getState().setProfileId(account.id, now);
    return false;
  }
  useCircleStore.getState().restoreAccount(
    {
      profile: merged.profile,
      account: { id: account.id, createdAt: account.createdAt ?? now },
      confirmedGeneration: merged.confirmedGeneration,
    },
    now,
  );

  // Once more if the first trip did not answer: the own marks only ever come with it.
  const own = (await restoreCircleSync()) ?? (await restoreCircleSync());
  if (own === null) {
    return true;
  }

  // Each challenge the user is in gets its habit back — the same name, the same
  // weekly target — unless the fifth slot is taken (rule 4): then it stays unjoined
  // here, and the challenge screen offers to join as it always does.
  for (const challenge of challengesToRejoin(useCircleStore.getState().challenges)) {
    useCircleStore.getState().joinChallenge(challenge.id, now);
  }
  const marks = marksToRestore(own, useCircleStore.getState().challenges, useAppStore.getState().habitMarks);
  useCircleStore.getState().restoreOwnMarks(marks, now);
  return true;
}
