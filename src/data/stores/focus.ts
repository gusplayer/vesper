import { create } from 'zustand';

import { resolveActivityId } from '../../db/boot';
import * as sessionsRepo from '../../db/repositories/sessions';
import {
  close as closeSession,
  createSession,
  interrupt,
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
 */

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
  start: (modeId: string, plannedMs: number, now: number) => void;
  finish: (outcome: CloseOutcome, now: number, exitReason?: string | null) => Session | null;
  setIntention: (text: string) => void;
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
    useSchemeStore.getState().setScheme(session === null ? 'light' : 'dark');
  },

  start: (modeId, plannedMs, now) => {
    if (get().session !== null) {
      return;
    }
    const mode = useAppStore.getState().modes.find((m) => m.id === modeId);
    const session = createSession(
      uuidv7(now),
      {
        activityId: resolveActivityId(mode?.activityId ?? 'trabajo'),
        plannedMs,
        depth: mode?.depth ?? 'soft',
        blockProfile: modeId,
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
    useAppStore.getState().recordFocus(now, closed.actualMs);
    set((state) => ({
      session: null,
      lastClosed: closed,
      completedCount: state.completedCount + (outcome === 'completed' ? 1 : 0),
    }));
    useSchemeStore.getState().setScheme('light');
    return closed;
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
