import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore, useFocusStore } from '../../data';
import { markOpenWindows, routineDecision } from '../../domain/routines';
import { SECOND } from '../../domain/time';

/** How often the engine looks at the clock while the app is open. */
const TICK_MS = 30 * SECOND;

/**
 * The routine engine's clock. Every half minute, on foreground, and whenever a
 * session ends, it asks the pure engine what to do: start the due routine's session,
 * wait because one is running, or nothing. What it started is remembered in settings,
 * one window per routine, so a window never starts twice. A window with no end time
 * starts an open session (the decision's `plannedMs` is null, ADR-0047 §3c).
 *
 * Inside the app only. While the app is closed, the reminders (notifications) carry
 * the routine, and on iOS with the entitlement the shield is scheduled natively.
 */
export function evaluateRoutines(now = Date.now()): void {
  const app = useAppStore.getState();
  // Before the onboarding is done there is no app to be in: a demo routine whose window
  // is open would start a session over the welcome screen. Finishing the onboarding
  // stamps every routine (updateSettings), so the window open at that moment does not
  // start either; the next one does.
  if (!app.settings.onboardingDone) {
    return;
  }
  const focus = useFocusStore.getState();
  const decision = routineDecision(app.schedules, focus.session !== null, app.settings.routineStarts, now);
  if (decision.action !== 'start') {
    return;
  }
  focus.start(decision.routine.modeId, decision.plannedMs, now);
  // One mark per routine: an overlapping routine's mark must never erase this one, or
  // this window would read as never started and run again on its own (ADR-0019).
  const current = useAppStore.getState().settings.routineStarts;
  app.updateSettings({
    routineStarts: { ...current, [decision.routine.id]: decision.window.start },
  });
}

/**
 * A session the user ended by choice — the exit ritual or an emergency unlock, both
 * 'cancelled' — marks every routine window open at that moment as started, so a routine
 * that was waiting does not lock them in again the instant they chose to stop
 * (ADR-0047 §3b). A session that ran its time out ('completed', 'expired') was not a
 * choice: the waiting routine starts, as ADR-0019 says.
 */
export function settleChosenEnd(now = Date.now()): void {
  const closed = useFocusStore.getState().lastClosed;
  if (closed === null || closed.outcome !== 'cancelled') {
    return;
  }
  const app = useAppStore.getState();
  const current = app.settings.routineStarts;
  const next = markOpenWindows(app.schedules, current, now);
  if (next !== current) {
    app.updateSettings({ routineStarts: next });
  }
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
      const ended = hadSession && !has;
      // Written before evaluating: a routine that starts from here writes the store
      // again, and this subscriber runs nested for it; it must see the new session.
      hadSession = has;
      if (ended) {
        settleChosenEnd();
        evaluateRoutines();
      }
    });
    return () => {
      clearInterval(interval);
      appState.remove();
      unsubscribe();
    };
  }, []);
}
