import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { useFocusStore } from '../../data/stores/focus';
import { blockPlan, isEmptyPlan, type BlockPlan } from '../../domain/blocking';
import { breakEndsAt, plannedEndAt } from '../../domain/session';
import type { Session } from '../../domain/types';
import { applyPlan, configureShield, pausePlan, release, resumePlan, status } from '../blocking';
import type { PlanTiming } from '../blockingTypes';

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

    // The end is never null outside a break; for an open session it is the cap, which
    // the Android service still honours while the notification counts up instead.
    const timingOf = (session: Session): PlanTiming => ({
      startedAt: session.startedAt,
      endsAt: plannedEndAt(session) ?? session.startedAt + session.plannedMs,
      open: session.open,
    });

    /** `replacing`: another session was running a moment ago, so its shield may still be up. */
    const apply = (modeId: string | null, session: Session, replacing: boolean) => {
      if (!status().available) {
        return;
      }
      const plan = planFor(modeId);
      if (isEmptyPlan(plan)) {
        // Nothing to shield for this session; what the previous one left goes down.
        if (replacing) {
          release();
        }
        return;
      }
      applyPlan(plan, timingOf(session));
    };

    const resume = (modeId: string | null, session: Session) => {
      if (!status().available) {
        return;
      }
      resumePlan(planFor(modeId), timingOf(session));
    };

    const current = useFocusStore.getState();
    if (current.session !== null && current.session.breakStartedAt === null) {
      apply(current.modeId, current.session, false);
    }

    const unsubscribe = useFocusStore.subscribe((state, previous) => {
      // The identity decides: a new session applies its own plan (also straight after
      // another one, should the store ever swap them without a null in between), and
      // no session releases. Editing the running session changes nothing here.
      const changed = state.session?.id !== previous.session?.id;
      const onBreak = state.session !== null && state.session.breakStartedAt !== null;
      const wasOnBreak = previous.session !== null && previous.session.breakStartedAt !== null;
      if (changed) {
        if (state.session === null) {
          release();
        } else if (!onBreak) {
          apply(state.modeId, state.session, previous.session !== null);
        }
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
