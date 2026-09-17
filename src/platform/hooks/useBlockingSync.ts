import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { useFocusStore } from '../../data/stores/focus';
import { blockPlan } from '../../domain/blocking';
import { plannedEndAt } from '../../domain/session';
import type { Session } from '../../domain/types';
import { applyPlan, configureShield, release, status } from '../blocking';

/**
 * Keeps Screen Time in step with the focus store by subscribing to it from outside:
 * the stores never import the platform, so the app builds where Family Controls is
 * missing (ADR-0017).
 *
 * A session starting in a mode with a real selection puts the shield up; the session
 * ending takes it down. A break takes it down too and the break ending puts it back
 * (ADR-0022). The user's rules travel with the plan, and the platform applies
 * the ones it can. The plan carries when the session is due to end, so a backend that
 * can time its own release (Android) does; iOS ignores it and waits for release(). On mount with a session already running (the app came back with a
 * hydrated session) the shield is applied again: ManagedSettings survives relaunches,
 * so this is a no-op most of the time, and the safe thing the rest of the time.
 */
export function useBlockingSync(): void {
  useEffect(() => {
    const apply = (modeId: string | null, session: Session) => {
      if (!status().available) {
        return;
      }
      const { modes, settings } = useAppStore.getState();
      const mode = modes.find((m) => m.id === modeId) ?? null;
      if (mode !== null) {
        configureShield(mode.name);
      }
      applyPlan(blockPlan(mode, settings.rules), plannedEndAt(session) ?? session.startedAt + session.plannedMs);
    };

    const current = useFocusStore.getState();
    if (current.session !== null && current.session.breakStartedAt === null) {
      apply(current.modeId, current.session);
    }

    const unsubscribe = useFocusStore.subscribe((state, previous) => {
      const started = previous.session === null && state.session !== null;
      const ended = previous.session !== null && state.session === null;
      const onBreak = state.session !== null && state.session.breakStartedAt !== null;
      const wasOnBreak = previous.session !== null && previous.session.breakStartedAt !== null;
      if (started && state.session !== null) {
        if (!onBreak) {
          apply(state.modeId, state.session);
        }
      } else if (ended) {
        release();
      } else if (state.session !== null && onBreak !== wasOnBreak) {
        if (onBreak) {
          release();
        } else {
          apply(state.modeId, state.session);
        }
      }
    });
    // The shield is meant to outlive this component: unmounting is the app dying,
    // not the session ending, so only the subscription goes.
    return unsubscribe;
  }, []);
}
