import { create } from 'zustand';

import {
  close as closeSession,
  createSession,
  expire,
  interrupt,
  type CloseOutcome,
  type SessionConfig,
} from '../domain/session';
import type { Session } from '../domain/types';
import * as sessions from '../db/repositories/sessions';
import * as settings from '../db/repositories/settings';
import { emptyToNull } from '../lib/text';
import { uuidv7 } from '../lib/uuid';

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
  /** Starts a session, or returns the one already running — invariant 1. */
  start: (config: SessionConfig, now: number) => Session;
  /**
   * Closes the running session and returns the closed row, so the session route can
   * show it after the store has let go of it — ADR-0015. Null when nothing was running.
   */
  finish: (outcome: CloseOutcome, now: number, exitReason?: string | null) => Session | null;
  /**
   * Closes a session whose time ran out while nobody was watching it: hydrated after a
   * relaunch and left on the home screen. Same verdict as an orphan at boot.
   */
  expireUnwatched: () => void;
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
    const running = get().session ?? sessions.findRunning();
    if (running !== null) {
      set({ session: running });
      return running;
    }
    const started = createSession(uuidv7(now), config, now);
    sessions.insert(started);
    set({ session: started });
    return started;
  },

  finish: (outcome, now, exitReason) => {
    const current = get().session;
    if (current === null) {
      return null;
    }
    const closed = closeSession(current, now, outcome, { exitReason: exitReason ?? null });
    sessions.update(closed);

    // Completing a session is what ends the first time — ADR-0012. Cancelling one does
    // not: the user has not seen a session through yet.
    if (
      outcome === 'completed' &&
      settings.getNumber(settings.SETTING_KEYS.onboardingCompletedAt) === null
    ) {
      settings.setNumber(settings.SETTING_KEYS.onboardingCompletedAt, now, now);
    }

    set({ session: null });
    return closed;
  },

  expireUnwatched: () => {
    const current = get().session;
    if (current === null) {
      return;
    }
    sessions.update(expire(current));
    set({ session: null });
  },

  setIntention: (intention) => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const updated = { ...current, intention: emptyToNull(intention) };
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
