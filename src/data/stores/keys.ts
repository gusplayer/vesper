import { create } from 'zustand';

import * as keysRepo from '../../db/repositories/keys';
import { keyCodeAt, matchKey, pairingCode, parsePairingCode } from '../../domain/key';
import type { PairedKey } from '../../domain/types';
import * as keyStore from '../../platform/keyStore';

/**
 * The keys paired with this phone (ADR-0034), cached from SQLite.
 *
 * The rows are here; the secrets are not. Every action that needs a secret asks the
 * keychain for it and lets it go, so a key's 32 bytes never sit in a zustand store
 * that a debugger or a state dump could read.
 *
 * `verify` is the one piece the session screens call: it takes whatever the camera
 * read and answers which key it belongs to, or null. It is async because the keychain
 * is, which is why the scan screens await it rather than deciding on the spot.
 */

/** A phone holds a handful of keys; more than this is a mistake, not a use case. */
export const MAX_KEYS = 5;

export type PairResult = 'ok' | 'full' | 'noKeychain' | 'badCode';

export type Verified = {
  keyId: string;
  /** The 30 s window the code belonged to. A session records the one that opened it. */
  step: number;
};

type KeysState = {
  keys: PairedKey[];
  hydrate: () => void;
  /**
   * Stores a key read from a pairing code. The id and the secret come from the other
   * device, because it is the one that will derive the codes.
   */
  pairFromCode: (text: string, name: string, now: number) => Promise<PairResult>;
  /**
   * Makes this phone a key: it invents the id and the secret, keeps them, and returns
   * the pairing code for the other phone to read.
   */
  createAsKey: (name: string, now: number) => Promise<{ ok: true; keyId: string; code: string } | { ok: false; reason: PairResult }>;
  rename: (id: string, name: string) => void;
  remove: (id: string) => Promise<void>;
  /** Which key a scanned code belongs to, or null. `after` rejects an already-used step. */
  verify: (text: string, now: number, after?: number | null) => Promise<Verified | null>;
  /** What this phone shows when it is acting as `keyId`. Null when the secret is gone. */
  codeFor: (keyId: string, now: number) => Promise<string | null>;
};

export const useKeysStore = create<KeysState>((set, get) => ({
  keys: [],

  hydrate: () => {
    set({ keys: keysRepo.list() });
  },

  pairFromCode: async (text, name, now) => {
    const pairing = parsePairingCode(text);
    if (pairing === null) {
      return 'badCode';
    }
    if (get().keys.length >= MAX_KEYS && keysRepo.findById(pairing.keyId) === null) {
      return 'full';
    }
    if (!(await keyStore.saveSecret(pairing.keyId, pairing.secret))) {
      return 'noKeychain';
    }
    keysRepo.insert({ id: pairing.keyId, name, role: 'scans', pairedAt: now });
    set({ keys: keysRepo.list() });
    return 'ok';
  },

  createAsKey: async (name, now) => {
    if (get().keys.length >= MAX_KEYS) {
      return { ok: false, reason: 'full' };
    }
    const id = keyStore.newKeyId();
    const secret = keyStore.newSecret();
    if (!(await keyStore.saveSecret(id, secret))) {
      return { ok: false, reason: 'noKeychain' };
    }
    keysRepo.insert({ id, name, role: 'shows', pairedAt: now });
    set({ keys: keysRepo.list() });
    // The other phone needs the secret once, to derive the same codes from now on.
    return { ok: true, keyId: id, code: pairingCode({ keyId: id, secret }) };
  },

  rename: (id, name) => {
    keysRepo.rename(id, name);
    set({ keys: keysRepo.list() });
  },

  remove: async (id) => {
    // The secret goes first: a row without a secret is a key that does not work, and a
    // secret without a row is a secret nobody can reach.
    await keyStore.forgetSecret(id);
    keysRepo.remove(id);
    set({ keys: keysRepo.list() });
  },

  verify: async (text, now, after = null) => {
    // The secrets are fetched here and the choosing happens in the domain, which is
    // where it can be tested. A key whose secret is gone from the keychain is left
    // out rather than failing the whole scan.
    const withSecrets: PairedKey[] = [];
    for (const key of get().keys) {
      const secret = await keyStore.readSecret(key.id);
      if (secret !== null) {
        withSecrets.push({ ...key, secret });
      }
    }
    const match = matchKey(withSecrets, text, now, after);
    if (match === null) {
      return null;
    }
    // The step is spent the moment it is accepted: a code is good once, ever.
    keysRepo.markStep(match.keyId, match.step);
    set({ keys: keysRepo.list() });
    return { keyId: match.keyId, step: match.step };
  },

  codeFor: async (keyId, now) => {
    const key = get().keys.find((entry) => entry.id === keyId);
    // A key that opens this phone is never drawn by this phone: that would be a lock
    // with its key taped to the door. Only a key this phone *is* has a code to show.
    if (key === undefined || key.role !== 'shows') {
      return null;
    }
    const secret = await keyStore.readSecret(keyId);
    if (secret === null) {
      return null;
    }
    return keyCodeAt({ ...key, secret }, now);
  },
}));
