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
  /** The mode the session runs, for the session screen. */
  modeId: string | null;
  /** The last closed session, for the completion screen. Not persisted. */
  lastClosed: Session | null;
  /** How many sessions have ever completed — the first one gets a different closing. */
  completedCount: number;
  /**
   * Picks up a session still running from a previous launch and puts the theme back
   * in dark for it. Orphans whose time already ran out were expired by boot.
   */
  hydrate: () => void;
  /** `plannedMs` null starts an open session ("sin límite"). */
  start: (modeId: string, plannedMs: number | null, now: number) => void;
  /**
   * The same start, opened by a key (ADR-0035). It runs deep whatever the mode says,
   * has no timer — the key ends it — and remembers the code's step so that same code
   * cannot also close it.
   */
  startWithKey: (modeId: string, now: number, key: { id: string; step: number }) => void;
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
  /**
   * Records a wrong dictated code against the running session (ADR-0037). The count
   * lives on the session and not on a clock, because the phone's owner owns the clock;
   * it dies with the session, which is the point.
   */
  recordKeyTry: () => void;
  registerInterruption: () => void;
};

export const useFocusStore = create<FocusState>((set, get) => ({
  session: null,
  modeId: null,
  lastClosed: null,
  completedCount: 0,

  hydrate: () => {
    const session = sessionsRepo.findRunning();
    set({
      session,
      modeId: session?.blockProfile ?? null,
      completedCount: sessionsRepo.countCompleted(),
    });
    useSchemeStore.getState().setScheme(schemeFor(session));
  },

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
    set({ session, modeId });
    useSchemeStore.getState().setScheme('dark');
  },

  startWithKey: (modeId, now, key) => {
    if (get().session !== null) {
      return;
    }
    const mode = useAppStore.getState().modes.find((m) => m.id === modeId);
    const session = createSession(
      uuidv7(now),
      {
        activityId: resolveActivityId(mode?.activityId ?? ''),
        plannedMs: 0,
        open: true,
        depth: mode?.depth ?? 'soft',
        blockProfile: modeId,
        key,
      },
      now,
    );
    sessionsRepo.insert(session);
    set({ session, modeId });
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
    set((state) => ({
      session: null,
      lastClosed: closed,
      completedCount: state.completedCount + (outcome === 'completed' ? 1 : 0),
    }));
    useSchemeStore.getState().setScheme('light');
    return closed;
  },

  recordKeyTry: () => {
    const current = get().session;
    if (current === null) {
      return;
    }
    const updated: Session = { ...current, keyTries: current.keyTries + 1 };
    sessionsRepo.update(updated);
    set({ session: updated });
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
    if (settled.outcome === 'running') {
      set({ session: settled });
    } else {
      useAppStore.getState().recordFocus(now);
      set((state) => ({
        session: null,
        lastClosed: settled,
        completedCount: state.completedCount + (settled.outcome === 'completed' ? 1 : 0),
      }));
    }
    useSchemeStore.getState().setScheme(schemeFor(settled.outcome === 'running' ? settled : null));
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
