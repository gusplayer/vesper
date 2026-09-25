import { useEffect } from 'react';
import { AppState } from 'react-native';

import { readIdentity, useIdentityStore } from '../../data/identity';
import { useFocusStore } from '../../data/stores/focus';
import { dayKeyOf } from '../../domain/day';
import {
  backupIfChanged,
  backupQuietUntil,
  deleteRemoteBackup,
  getBackupState,
  remoteCopyMayExist,
  subscribeBackup,
  type BackupOutcome,
} from '../backup';
import { BACKUP_DELAY_MS, backupDue, strongerTrigger, type BackupTrigger } from '../backupPolicy';
import { loadIdentity } from '../identity';

/**
 * When the encrypted backup goes out on its own (ADR-0048 §7): after a session closes,
 * and when the app comes to the front at most once a day — only with the switch on and
 * an identity the server knows, and never when nothing changed since the last upload.
 *
 * It never blocks and never throws: a backup that cannot go out (no network, a 429,
 * another install's newer copy) is written down for Ajustes › Respaldo and tried again
 * at the next trigger. The rule itself is src/platform/backupPolicy.ts.
 */

type Memory = {
  /** The last automatic attempt of this process. */
  lastAttemptAt: number;
  /** The day the server's copy was last found current, or left alone on purpose. */
  checkedDayKey: string | null;
};

const memory: Memory = { lastAttemptAt: 0, checkedDayKey: null };

/** Tests and "Borrar todo y reiniciar": the next front checks again. */
export function forgetBackupSync(): void {
  memory.lastAttemptAt = 0;
  memory.checkedDayKey = null;
}

/** Outcomes after which there is nothing more to do today on a front. */
const SETTLED: readonly BackupOutcome[] = ['done', 'unchanged', 'newerElsewhere', 'off'];

async function automaticBackup(trigger: BackupTrigger): Promise<void> {
  try {
    const now = Date.now();
    const state = getBackupState();
    const identity = readIdentity();
    if (identity === null || identity.registeredAt === null) {
      return;
    }
    if (!state.enabled) {
      // Off means no copy on the server either: one that could not be deleted when the
      // switch moved (no network) is deleted now.
      if (remoteCopyMayExist(state) && now >= backupQuietUntil()) {
        const credentials = await loadIdentity();
        if (credentials !== null) {
          await deleteRemoteBackup(credentials, Date.now());
        }
      }
      return;
    }
    const due = backupDue({
      trigger,
      now,
      lastAt: state.lastAt,
      lastAttemptAt: memory.lastAttemptAt,
      checkedDayKey: memory.checkedDayKey,
      notBefore: backupQuietUntil(),
    });
    if (!due) {
      return;
    }
    memory.lastAttemptAt = now;
    const credentials = await loadIdentity();
    if (credentials === null) {
      return;
    }
    const outcome = await backupIfChanged(credentials, Date.now());
    if (SETTLED.includes(outcome)) {
      memory.checkedDayKey = dayKeyOf(Date.now());
    }
  } catch {
    // Offline is fine, and so is anything else: the next trigger tries again.
  }
}

export function useBackupSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: BackupTrigger | null = null;

    // Later, not now: the export reads the whole database on the JS thread, and the
    // closing screen or the first frame after a return should draw first.
    const schedule = (trigger: BackupTrigger) => {
      pending = strongerTrigger(pending, trigger);
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        const next = pending ?? trigger;
        timer = null;
        pending = null;
        void automaticBackup(next);
      }, BACKUP_DELAY_MS);
    };

    schedule('front');

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        schedule('front');
      }
    });

    // A session closed: the one that was running is gone, whether nothing or the next
    // routine's session took its place.
    const unsubscribeFocus = useFocusStore.subscribe((state, previous) => {
      if (previous.session !== null && state.session?.id !== previous.session.id) {
        schedule('session');
      }
    });

    // The identity reached the server: the first backup need not wait for tomorrow.
    const unsubscribeIdentity = useIdentityStore.subscribe((state, previous) => {
      if (state.registered && !previous.registered) {
        // A new identity has no copy on the server: today's check was the old one's.
        memory.checkedDayKey = null;
        schedule('front');
      }
    });

    // Switched in Ajustes: back on, check whether the server's copy is behind; off,
    // delete it.
    let wasEnabled = getBackupState().enabled;
    const unsubscribeBackup = subscribeBackup(() => {
      const enabled = getBackupState().enabled;
      if (enabled !== wasEnabled) {
        memory.checkedDayKey = null;
        schedule('front');
      }
      wasEnabled = enabled;
    });

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      appState.remove();
      unsubscribeFocus();
      unsubscribeIdentity();
      unsubscribeBackup();
    };
  }, []);
}
