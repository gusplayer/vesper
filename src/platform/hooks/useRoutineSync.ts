import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore, useFocusStore } from '../../data';
import { routineDecision } from '../../domain/routines';
import { SECOND } from '../../domain/time';

/** How often the engine looks at the clock while the app is open. */
const TICK_MS = 30 * SECOND;

/**
 * The routine engine's clock. Every half minute, on foreground, and whenever a
 * session ends, it asks the pure engine what to do: start the due routine's session,
 * wait because one is running, or nothing. What it started is remembered in settings
 * so a window never starts twice.
 *
 * Inside the app only. While the app is closed, the reminders (notifications) carry
 * the routine, and on iOS with the entitlement the shield is scheduled natively.
 */
export function evaluateRoutines(now = Date.now()): void {
  const app = useAppStore.getState();
  const focus = useFocusStore.getState();
  const decision = routineDecision(app.schedules, focus.session !== null, app.settings.lastRoutineStart, now);
  if (decision.action !== 'start') {
    return;
  }
  focus.start(decision.routine.modeId, decision.plannedMs, now);
  app.updateSettings({
    lastRoutineStart: { routineId: decision.routine.id, windowStart: decision.window.start },
  });
}

export function useRoutineSync(): void {
  useEffect(() => {
    evaluateRoutines();
    const interval = setInterval(() => evaluateRoutines(), TICK_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        evaluateRoutines();
      }
    });
    // A session ending is the moment a waiting routine has been waiting for.
    let hadSession = useFocusStore.getState().session !== null;
    const unsubscribe = useFocusStore.subscribe((state) => {
      const has = state.session !== null;
      if (hadSession && !has) {
        evaluateRoutines();
      }
      hadSession = has;
    });
    return () => {
      clearInterval(interval);
      appState.remove();
      unsubscribe();
    };
  }, []);
}
