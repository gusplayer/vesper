import { create } from 'zustand';

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
 * The running focus session. A real clock over the pure domain logic, so the
 * prototype's timer behaves exactly like the product's will. Starting a session flips
 * the theme to dark; ending it flips back (ADR-0016).
 */

type FocusState = {
  session: Session | null;
  /** The mode the session runs, for the session screen. */
  modeId: string | null;
  /** The last closed session, for the completion screen. */
  lastClosed: Session | null;
  /** How many sessions have ever completed — the first one gets a different closing. */
  completedCount: number;
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

  start: (modeId, plannedMs, now) => {
    if (get().session !== null) {
      return;
    }
    const mode = useAppStore.getState().modes.find((m) => m.id === modeId);
    const session = createSession(
      uuidv7(now),
      { activityId: mode?.activityId ?? 'trabajo', plannedMs, depth: mode?.depth ?? 'soft', blockProfile: modeId },
      now,
    );
    set({ session, modeId });
    useSchemeStore.getState().setScheme('dark');
  },

  finish: (outcome, now, exitReason) => {
    const current = get().session;
    if (current === null) {
      return null;
    }
    const closed = closeSession(current, now, outcome, { exitReason: exitReason ?? null });
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
    if (current !== null) {
      set({ session: { ...current, intention: emptyToNull(text) } });
    }
  },

  registerInterruption: () => {
    const current = get().session;
    if (current !== null) {
      set({ session: interrupt(current) });
    }
  },
}));
