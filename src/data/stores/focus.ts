import { create } from 'zustand';

import { resolveActivityId } from '../../db/boot';
import * as sessionsRepo from '../../db/repositories/sessions';
import {
  close as closeSession,
  createSession,
  endBreak,
  interrupt,
  settle,
  startBreak,
  type CloseOutcome,
} from '../../domain/session';
import type { Session } from '../../domain/types';
import { useSchemeStore } from '../../design/theme';
import { emptyToNull } from '../../lib/text';
import { uuidv7 } from '../../lib/uuid';
import { useAppStore } from './app';

/**
 * The running focus session. A real clock over the pure domain logic; the row lives
 * in SQLite and this store is a cache of the one that matters right now, so a session
 * survives the app being killed (ADR-0017). Starting a session flips the theme to
 * dark; ending it flips back (ADR-0016).
 *
 * The mode a session runs is kept in the row's `blockProfile` column: the mode is
 * what decides what gets blocked, which is exactly what that column was reserved for.
 *
 * A break (ADR-0022) flips the theme back to light while it lasts: light is the app,
 * dark is the session, and a break is not the session.
 */

function schemeFor(session: Session | null): 'light' | 'dark' {
  return session === null || session.breakStartedAt !== null ? 'light' : 'dark';
}

type FocusState = {
  session: Session | null;
  /**
   * The mode the running session runs, for the session screen. The closing screens read
   * `lastClosed.blockProfile` instead: a routine that was waiting starts its session the
   * moment this one closes, and overwrites this.
   */
  modeId: string | null;
  /** The last closed session, for the completion screen. Not persisted. */
  lastClosed: Session | null;
  /** How many sessions have ever completed — the first one gets a different closing. */
  completedCount: number;
  /**
   * True when `lastClosed` is a session that ran out while the app was dead, so nobody
   * saw it close (ADR-0047 §9). SessionGate shows `session/complete` for it once, on
   * this open, and calls `closingSeen`.
   */
  unseenClosing: boolean;
  /**
   * Picks up a session still running from a previous launch and puts the theme back
   * in dark for it. Orphans whose time already ran out were closed by boot
   * (sessionsRepo.recoverOrphans); the last one it closed comes in as `recovered`, and
   * its closing is owed to the user once.
   */
  hydrate: (recovered?: Session | null) => void;
  /** The owed closing was shown: it is not shown again. */
  closingSeen: () => void;
  /** `plannedMs` null starts an open session ("sin límite"). */
  start: (modeId: string, plannedMs: number | null, now: number) => void;
  finish: (outcome: CloseOutcome, now: number, exitReason?: string | null) => Session | null;
  /** Starts a break; a no-op when the domain says no. */
  takeBreak: (now: number) => void;
  /** Ends the running break, by hand or because its time is up; a no-op outside one. */
  resume: (now: number) => void;
  /**
   * Catches up after the app was asleep: ends a break past its length and closes a
   * session past its end at that end, with its due verdict (domain/session.settle).
   * Both in one call. Returns what changed, if anything; a closed session comes back
   * with its outcome so the caller can navigate to the closing screen.
   */
  settleNow: (now: number) => Session | null;
  setIntention: (text: string) => void;
  registerInterruption: () => void;
};

export const useFocusStore = create<FocusState>((set, get) => ({
  session: null,
  modeId: null,
  lastClosed: null,
  completedCount: 0,
  unseenClosing: false,

  hydrate: (recovered = null) => {
    const session = sessionsRepo.findRunning();
    // Only a session that ran its time out gets a closing: 'completed', or 'expired' at
    // the cap. A running one continues; a cancelled one was closed on screen.
    const owed =
      session === null && recovered !== null && (recovered.outcome === 'completed' || recovered.outcome === 'expired')
        ? recovered
        : null;
    set((state) => ({
      session,
      modeId: session?.blockProfile ?? null,
      completedCount: sessionsRepo.countCompleted(),
      lastClosed: owed ?? state.lastClosed,
      unseenClosing: owed !== null,
    }));
    useSchemeStore.getState().setScheme(schemeFor(session));
  },

  closingSeen: () => set({ unseenClosing: false }),

  start: (modeId, plannedMs, now) => {
    if (get().session !== null) {
      return;
    }
    const mode = useAppStore.getState().modes.find((m) => m.id === modeId);
    const session = createSession(
      uuidv7(now),
      {
        // No mode, no key: resolveActivityId falls back to the first activity.
        activityId: resolveActivityId(mode?.activityId ?? ''),
        plannedMs: plannedMs ?? 0,
        open: plannedMs === null,
        depth: mode?.depth ?? 'soft',
        blockProfile: modeId,
      },
      now,
    );
    sessionsRepo.insert(session);
    // A new session makes an owed closing old news: it is not shown after this one.
    set({ session, modeId, unseenClosing: false });
    useSchemeStore.getState().setScheme('dark');
  },

  finish: (outcome, now, exitReason) => {
    const current = get().session;
    if (current === null) {
      return null;
    }
    const closed = closeSession(current, now, outcome, { exitReason: exitReason ?? null });
    sessionsRepo.update(closed);
    useAppStore.getState().recordFocus(now);
    // The scheme goes first. `set` notifies subscribers synchronously, and the routine
    // engine is one of them: a routine that was waiting starts its session inside this
    // `set` and turns the scheme dark. Setting light afterwards would paint that new
    // session in the app's colors.
    useSchemeStore.getState().setScheme('light');
    set((state) => ({
      session: null,
      lastClosed: closed,
      unseenClosing: false,
      completedCount: state.completedCount + (outcome === 'completed' ? 1 : 0),
    }));
    return closed;
  },

  takeBreak: (now) => {
    const current = get().session;
    if (current === null || current.breakStartedAt !== null) {
      return;
    }
    let updated: Session;
    try {
      updated = startBreak(current, now);
    } catch {
      return;
    }
    sessionsRepo.update(updated);
    set({ session: updated });
    useSchemeStore.getState().setScheme(schemeFor(updated));
  },

  resume: (now) => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const updated = endBreak(current, now);
    if (updated === current) {
      return;
    }
    sessionsRepo.update(updated);
    set({ session: updated });
    useSchemeStore.getState().setScheme(schemeFor(updated));
  },

  settleNow: (now) => {
    const current = get().session;
    if (current === null) {
      return null;
    }
    const settled = settle(current, now);
    if (settled === current) {
      return null;
    }
    sessionsRepo.update(settled);
    // Before `set`, for the reason `finish` gives: a waiting routine may start its
    // session from inside it, and its dark scheme must be the last word.
    useSchemeStore.getState().setScheme(schemeFor(settled.outcome === 'running' ? settled : null));
    if (settled.outcome === 'running') {
      set({ session: settled });
    } else {
      useAppStore.getState().recordFocus(now);
      set((state) => ({
        session: null,
        lastClosed: settled,
        unseenClosing: false,
        completedCount: state.completedCount + (settled.outcome === 'completed' ? 1 : 0),
      }));
    }
    return settled;
  },

  setIntention: (text) => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const updated = { ...current, intention: emptyToNull(text) };
    sessionsRepo.update(updated);
    set({ session: updated });
  },

  registerInterruption: () => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const updated = interrupt(current);
    if (updated !== current) {
      sessionsRepo.update(updated);
      set({ session: updated });
    }
  },
}));
