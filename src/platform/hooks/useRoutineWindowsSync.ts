import { useEffect } from 'react';

import { useAppStore } from '../../data/stores/app';
import { routineWindowPlans } from '../../domain/routineWindows';
import { getStrings, useLocaleStore } from '../../i18n';
import { cancelWindow, listWindowIds, scheduleWindow, status } from '../blocking';

/** Store changes arrive in bursts (a routine editor saves several fields); settle first. */
const DEBOUNCE_MS = 500;

/**
 * Keeps the system's routine windows equal to the routines in the store, so the shield
 * rises and falls on schedule while the app is closed (ADR-0019). Subscribes from the
 * outside, like useBlockingSync: the stores never import the platform.
 *
 * On mount and on every change to routines or modes it reconciles: every enabled,
 * timed routine whose mode has a selection is scheduled, and every window the system
 * still holds for a routine that no longer wants one is cancelled. A window whose spec
 * did not change since it was last handed over is left alone, so editing one routine
 * does not restart the others. Where blocking is unavailable nothing is touched.
 */
export function useRoutineWindowsSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Reconciliations run one after another; a burst never interleaves two of them.
    let queue: Promise<void> = Promise.resolve();
    const applied = new Map<string, string>();

    const request = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        queue = queue.then(() => reconcile(applied));
      }, DEBOUNCE_MS);
    };

    request();
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.schedules !== previous.schedules || state.modes !== previous.modes) {
        request();
      }
    });
    // A language change rewrites the shield text of every window.
    const unsubscribeLocale = useLocaleStore.subscribe(() => request());
    // The windows are meant to outlive this component: unmounting is the app dying,
    // not the routines ending, so only the timer and the subscription go.
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      unsubscribe();
      unsubscribeLocale();
    };
  }, []);
}

/**
 * One pass. `applied` remembers, per routine, the serialized spec last handed to the
 * platform; a spec that matches and is still registered is skipped.
 */
async function reconcile(applied: Map<string, string>): Promise<void> {
  if (!status().available) {
    return;
  }
  const { schedules, modes } = useAppStore.getState();
  const wanted = routineWindowPlans(schedules, modes, getStrings().session.shield);
  const wantedIds = new Set(wanted.map((plan) => plan.id));
  const registered = await listWindowIds();
  for (const id of registered) {
    if (!wantedIds.has(id)) {
      await cancelWindow(id);
      applied.delete(id);
    }
  }
  for (const plan of wanted) {
    const key = JSON.stringify(plan);
    if (applied.get(plan.id) === key && registered.includes(plan.id)) {
      continue;
    }
    await scheduleWindow(plan);
    applied.set(plan.id, key);
  }
}
