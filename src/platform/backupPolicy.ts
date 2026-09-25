import { dayKeyOf } from '../domain/day';
import { SECOND, MINUTE } from '../domain/time';

/**
 * When the automatic backup goes out (ADR-0048 §7): after a session closes, and when the
 * app comes to the front at most once a day. Pure, so the rule is tested; the hook that
 * applies it is src/platform/hooks/useBackupSync.ts.
 */

/** What woke the backup up. */
export type BackupTrigger = 'session' | 'front';

/**
 * The floor between two automatic attempts, whatever woke them. Short sessions one after
 * another, or a phone that keeps coming to the front offline, never become a stream of
 * uploads: the server allows 30 an hour and this stays far under it.
 */
export const MIN_ATTEMPT_GAP_MS = 5 * MINUTE;

/**
 * How long after the trigger the attempt waits. Reading the whole database is
 * synchronous; three seconds lets the closing screen or the first frame draw first.
 */
export const BACKUP_DELAY_MS = 3 * SECOND;

export type BackupDueInput = {
  trigger: BackupTrigger;
  now: number;
  /** The last upload the server accepted, or null. */
  lastAt: number | null;
  /** The last automatic attempt of this process, 0 for none. */
  lastAttemptAt: number;
  /**
   * The day this process last found the server's copy current (an upload, or nothing
   * new to send), so a front with nothing new is checked once a day and not on every
   * return.
   */
  checkedDayKey: string | null;
  /** A 429 asked for quiet until this instant. */
  notBefore: number;
};

/** Whether an automatic backup should be attempted now. Enabled and registered are checked before this. */
export function backupDue(input: BackupDueInput): boolean {
  const { trigger, now, lastAt, lastAttemptAt, checkedDayKey, notBefore } = input;
  if (now < notBefore || now - lastAttemptAt < MIN_ATTEMPT_GAP_MS) {
    return false;
  }
  if (trigger === 'session') {
    return true;
  }
  const today = dayKeyOf(now);
  if (checkedDayKey === today) {
    return false;
  }
  return lastAt === null || dayKeyOf(lastAt) !== today;
}

/**
 * Whether an automatic upload may replace what the server holds. Only a copy this
 * install wrote (or restored) last: `remoteAt` is that copy's server stamp. Anything
 * newer came from another install — the lost phone's last day, when Android's own
 * backup brought back an older database here — and replacing it on its own would
 * throw that away. "Respaldar ahora" still can; it is the person deciding.
 */
export function mayReplace(remote: { updatedAt: number } | null, remoteAt: number | null): boolean {
  if (remote === null) {
    return true;
  }
  return remoteAt !== null && remote.updatedAt <= remoteAt;
}

/** The stronger of a pending trigger and a new one: a closed session wins over a front. */
export function strongerTrigger(pending: BackupTrigger | null, next: BackupTrigger): BackupTrigger {
  return pending === 'session' ? 'session' : next;
}
