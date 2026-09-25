import { useEffect, useState } from 'react';

import { useIdentityStore } from '../../data/identity';
import { fetchBackupMeta } from '../../platform/backup';
import { startFresh } from '../../platform/hooks/useIdentitySync';
import { readStoredCredential } from '../../platform/identity';

/**
 * What the welcome screen knows about a previous Vesper on this phone (ADR-0048 §4):
 * whether the first look at the keychain is over, whether it found one, and from when
 * its backup is.
 *
 * - `loading`: the server is being asked.
 * - `unknown`: the server could not be asked (no connection), and the line says so.
 * - `none`: it has no backup; its circle and its challenge marks still come back.
 * - `at`: the backup's date, epoch ms.
 */
export type FoundBackup = { kind: 'loading' } | { kind: 'unknown' } | { kind: 'none' } | { kind: 'at'; at: number };

export type FoundVesper = {
  /** False for the few milliseconds before the keychain answered. */
  checked: boolean;
  /** Null when there is no previous Vesper to offer. */
  found: { id: string; backup: FoundBackup } | null;
};

export function useFoundVesper(): FoundVesper {
  const checked = useIdentityStore((state) => state.checked);
  const found = useIdentityStore((state) => state.found);
  const [backup, setBackup] = useState<{ id: string; backup: FoundBackup } | null>(null);

  const foundId = found?.id ?? null;
  useEffect(() => {
    if (foundId === null) {
      return;
    }
    let live = true;
    void readStoredCredential()
      .then((stored) => (stored === null || stored.id !== foundId ? null : fetchBackupMeta(stored)))
      .then((meta) => {
        if (!live) {
          return;
        }
        if (meta !== null && !meta.ok && meta.failure.kind === 'unauthorized') {
          // The key opens nothing any more (its account was deleted from elsewhere):
          // there is nothing to restore and nothing to delete, and the phone starts
          // over by itself instead of offering a restore that can only fail.
          void startFresh(Date.now());
          return;
        }
        const line: FoundBackup =
          meta === null || !meta.ok
            ? { kind: 'unknown' }
            : meta.value === null
              ? { kind: 'none' }
              : { kind: 'at', at: meta.value.updatedAt };
        setBackup({ id: foundId, backup: line });
      });
    return () => {
      live = false;
    };
  }, [foundId]);

  if (foundId === null) {
    return { checked, found: null };
  }
  return {
    checked,
    found: { id: foundId, backup: backup !== null && backup.id === foundId ? backup.backup : { kind: 'loading' } },
  };
}
