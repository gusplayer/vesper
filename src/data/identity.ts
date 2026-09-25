import { create } from 'zustand';

import * as settingsRepo from '../db/repositories/settings';
import type { IdentityRecord } from '../db/repositories/settings';

export type { IdentityRecord };

/**
 * The identity without login (ADR-0048 §2), as the data layer holds it: the record in
 * the settings table, read and written here, and two facts about right now that the
 * welcome screen waits on.
 *
 * The record is read from SQLite on every call instead of being cached: it changes a
 * handful of times in the life of an install, and a restore swaps the whole database
 * under the stores (src/platform/backup.ts), so a cache would be one more thing to
 * rehydrate for no gain. The secret is never here; it lives in platform/identity.
 */

export function readIdentity(): IdentityRecord | null {
  return settingsRepo.getIdentity();
}

export function writeIdentity(record: IdentityRecord, now: number): void {
  settingsRepo.setIdentity(record, now);
  useIdentityStore.setState({ id: record.id, registered: record.registeredAt !== null });
}

export function eraseIdentity(): void {
  settingsRepo.deleteIdentity();
  useIdentityStore.setState({ id: null, registered: false });
}

export function readIdentityPingAt(): number | null {
  return settingsRepo.getIdentityPingAt();
}

export function writeIdentityPingAt(at: number): void {
  settingsRepo.setIdentityPingAt(at, at);
}

/**
 * A key found in the keychain (or the copy that travels) that no identity of this
 * install claims, while the onboarding has not been done: a previous Vesper — a new
 * phone, a reinstall. Only the id is kept here; the secret is read again from the
 * keychain when the user decides.
 */
export type FoundIdentity = { id: string };

type IdentityState = {
  /** This install's identity id, once there is one. Mirrors the record for screens. */
  id: string | null;
  registered: boolean;
  /** Null when nothing was found, or once the user decided (restore or start over). */
  found: FoundIdentity | null;
  /**
   * True once the first look at the keychain finished. The welcome screen waits for it
   * so "Empezar" is never tapped past a previous Vesper that was about to show up.
   */
  checked: boolean;
  setFound: (found: FoundIdentity | null) => void;
  setChecked: () => void;
  /** Re-reads the record: after a reset or a restore replaced the database. */
  refresh: () => void;
};

export const useIdentityStore = create<IdentityState>((set) => ({
  id: null,
  registered: false,
  found: null,
  checked: false,
  setFound: (found) => set({ found }),
  setChecked: () => set({ checked: true }),
  refresh: () => {
    const record = settingsRepo.getIdentity();
    set({ id: record?.id ?? null, registered: record !== null && record.registeredAt !== null });
  },
}));
