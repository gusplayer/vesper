import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { useFocusStore } from '../../data/stores/focus';
import { blockPlan, type BlockPlan } from '../../domain/blocking';
import { breakEndsAt, plannedEndAt } from '../../domain/session';
import type { Session } from '../../domain/types';
import { applyPlan, configureShield, pausePlan, release, resumePlan, status } from '../blocking';

/**
 * Keeps the platform's blocking in step with the focus store by subscribing to it
 * from outside: the stores never import the platform, so the app builds where the
 * capability is missing (ADR-0017).
 *
 * A session starting in a mode with a real selection puts the shield up; the session
 * ending takes it down. A break pauses the plan until the break's end and the break
 * ending resumes it with the session's new end (ADR-0022, ADR-0023): on Android the
 * service stays alive through the break and comes back by itself; on iOS pausing is
 * releasing and resuming is applying, and this hook never learns which. The user's
 * rules travel with the plan, and the platform applies the ones it can. The plan
 * carries when the session is due to end, so a backend that can time its own release
 * (Android) does; iOS ignores it and waits for release(). On mount with a session
 * already running (the app came back with a hydrated session) the shield is applied
 * again: ManagedSettings survives relaunches, so this is a no-op most of the time,
 * and the safe thing the rest of the time. On mount during a break nothing is done:
 * the Android service is already counting it, and iOS has nothing up.
 */
export function useBlockingSync(): void {
  useEffect(() => {
    const planFor = (modeId: string | null): BlockPlan => {
      const { modes, settings } = useAppStore.getState();
      const mode = modes.find((m) => m.id === modeId) ?? null;
      if (mode !== null) {
        configureShield(mode.name);
      }
      return blockPlan(mode, settings.rules);
    };

    // Never null outside a break; the cap for an open session.
    const endOf = (session: Session): number => plannedEndAt(session) ?? session.startedAt + session.plannedMs;

    const apply = (modeId: string | null, session: Session) => {
      if (!status().available) {
        return;
      }
      applyPlan(planFor(modeId), endOf(session));
    };

    const resume = (modeId: string | null, session: Session) => {
      if (!status().available) {
        return;
      }
      resumePlan(planFor(modeId), endOf(session));
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
        const breakEnd = breakEndsAt(state.session);
        if (onBreak && breakEnd !== null) {
          if (status().available) {
            pausePlan(breakEnd);
          }
        } else if (!onBreak) {
          resume(state.modeId, state.session);
        }
      }
    });
    // The shield is meant to outlive this component: unmounting is the app dying,
    // not the session ending, so only the subscription goes.
    return unsubscribe;
  }, []);
}
