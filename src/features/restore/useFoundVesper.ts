import { useEffect, useState } from 'react';

import { useIdentityStore } from '../../data/identity';
import { fetchBackupMeta } from '../../platform/backup';
import { getAccount } from '../../platform/circleApi';
import { startFresh } from '../../platform/hooks/useIdentitySync';
import { readStoredCredential } from '../../platform/identity';
import { foundUseOf, type FoundUse } from './foundUse';

/**
 * What the welcome screen knows about a previous Vesper on this phone (ADR-0048 §4):
 * whether the first look at the keychain is over, whether it found one, from when its
 * backup is, and whether another device still uses it (ADR-0050 §9).
 *
 * - `loading`: the server is being asked.
 * - `unknown`: the server could not be asked (no connection), and the line says so.
 * - `none`: it has no backup; its circle and its challenge marks still come back.
 * - `at`: the backup's date, epoch ms.
 *
 * Both questions are reads, which the server never counts as a use: asking cannot make
 * the Vesper look in use. Nothing here writes before `lastSeenAt` is read.
 */
export type FoundBackup = { kind: 'loading' } | { kind: 'unknown' } | { kind: 'none' } | { kind: 'at'; at: number };

export type { FoundUse };

export type FoundVesper = {
  /** False for the few milliseconds before the keychain answered. */
  checked: boolean;
  /** Null when there is no previous Vesper to offer. */
  found: { id: string; backup: FoundBackup; use: FoundUse } | null;
};

type Answer = { id: string; backup: FoundBackup; use: FoundUse };

export function useFoundVesper(): FoundVesper {
  const checked = useIdentityStore((state) => state.checked);
  const found = useIdentityStore((state) => state.found);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const foundId = found?.id ?? null;
  useEffect(() => {
    if (foundId === null) {
      return;
    }
    let live = true;
    void (async () => {
      const stored = await readStoredCredential();
      if (stored === null || stored.id !== foundId) {
        if (live) {
          setAnswer({ id: foundId, backup: { kind: 'unknown' }, use: { kind: 'unknown' } });
        }
        return;
      }
      const [account, meta] = await Promise.all([getAccount(stored), fetchBackupMeta(stored)]);
      if (!live) {
        return;
      }
      if (!account.ok && account.failure.kind === 'unauthorized') {
        // The key opens nothing any more (its account was deleted from elsewhere, or
        // another device took it and changed the secret): there is nothing to restore
        // and nothing to delete, and the phone starts over by itself instead of offering
        // a restore that can only fail.
        void startFresh(Date.now());
        return;
      }
      const use: FoundUse = account.ok ? foundUseOf(account.value.lastSeenAt, Date.now()) : { kind: 'unknown' };
      const backup: FoundBackup = !meta.ok
        ? { kind: 'unknown' }
        : meta.value === null
          ? { kind: 'none' }
          : { kind: 'at', at: meta.value.updatedAt };
      setAnswer({ id: foundId, backup, use });
    })();
    return () => {
      live = false;
    };
  }, [foundId]);

  if (foundId === null) {
    return { checked, found: null };
  }
  const current = answer !== null && answer.id === foundId ? answer : null;
  return {
    checked,
    found: {
      id: foundId,
      backup: current?.backup ?? { kind: 'loading' },
      use: current?.use ?? { kind: 'loading' },
    },
  };
}
