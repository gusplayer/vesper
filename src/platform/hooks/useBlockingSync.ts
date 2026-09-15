import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { useFocusStore } from '../../data/stores/focus';
import { blockPlan } from '../../domain/blocking';
import { applyPlan, configureShield, release, status } from '../blocking';

/**
 * Keeps Screen Time in step with the focus store by subscribing to it from outside:
 * the stores never import the platform, so the app builds where Family Controls is
 * missing (ADR-0017).
 *
 * A session starting in a mode with a real selection puts the shield up; the session
 * ending takes it down. The user's rules travel with the plan, and the platform applies
 * the ones it can. On mount with a session already running (the app came back with a
 * hydrated session) the shield is applied again: ManagedSettings survives relaunches,
 * so this is a no-op most of the time, and the safe thing the rest of the time.
 */
export function useBlockingSync(): void {
  useEffect(() => {
    const apply = (modeId: string | null) => {
      if (!status().available) {
        return;
      }
      const { modes, settings } = useAppStore.getState();
      const mode = modes.find((m) => m.id === modeId) ?? null;
      if (mode !== null) {
        configureShield(mode.name);
      }
      applyPlan(blockPlan(mode, settings.rules));
    };

    const current = useFocusStore.getState();
    if (current.session !== null) {
      apply(current.modeId);
    }

    const unsubscribe = useFocusStore.subscribe((state, previous) => {
      const started = previous.session === null && state.session !== null;
      const ended = previous.session !== null && state.session === null;
      if (started) {
        apply(state.modeId);
      } else if (ended) {
        release();
      }
    });
    // The shield is meant to outlive this component: unmounting is the app dying,
    // not the session ending, so only the subscription goes.
    return unsubscribe;
  }, []);
}
