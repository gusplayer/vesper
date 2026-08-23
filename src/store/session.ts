import { create } from 'zustand';

import {
  close as closeSession,
  createSession,
  interrupt,
  type CloseOutcome,
  type SessionConfig,
} from '../domain/session';
import type { Session } from '../domain/types';
import * as sessions from '../db/repositories/sessions';

/**
 * The running session. Ephemeral UI state only — the truth lives in SQLite, and this
 * store is a cache of the one row that matters right now.
 *
 * The timer is not here: it is computed from `startedAt` wherever it is displayed, so
 * there is no tick to keep in sync.
 */

type SessionStore = {
  session: Session | null;
  /** Reads the running session from the database. Called once at startup. */
  hydrate: () => void;
  start: (config: SessionConfig, now: number) => Session;
  finish: (outcome: CloseOutcome, now: number, exitReason?: string | null) => void;
  /** The intention is written on the session screen, where it is also displayed. */
  setIntention: (intention: string) => void;
  registerInterruption: () => void;
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,

  hydrate: () => {
    set({ session: sessions.findRunning() });
  },

  start: (config, now) => {
    const started = createSession(sessions.newId(now), config, now);
    sessions.insert(started);
    set({ session: started });
    return started;
  },

  finish: (outcome, now, exitReason) => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const closed = closeSession(current, now, outcome, { exitReason: exitReason ?? null });
    sessions.update(closed);
    set({ session: null });
  },

  setIntention: (intention) => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const trimmed = intention.trim();
    const updated = { ...current, intention: trimmed === '' ? null : trimmed };
    sessions.update(updated);
    set({ session: updated });
  },

  registerInterruption: () => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const updated = interrupt(current);
    if (updated !== current) {
      sessions.update(updated);
      set({ session: updated });
    }
  },
}));
