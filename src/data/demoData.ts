import { useAppStore } from './stores/app';
import { useCircleStore } from './stores/circle';
import { useFocusStore } from './stores/focus';

/**
 * "Quitar los datos de ejemplo" from Ajustes (ADR-0047 §1): deletes only what the seed
 * wrote and refreshes both caches, the app's and the circle's, so Focus, Actividad and
 * the circle stop showing the examples at once and `useHasDemoData()` turns false.
 *
 * Refused while a session runs: its mode may be one of the examples, and pulling the
 * mode out from under a running session is not a cleanup. Returns whether it ran.
 */
export function removeDemoData(now: number): boolean {
  if (useFocusStore.getState().session !== null) {
    return false;
  }
  useAppStore.getState().removeDemoData(now);
  useCircleStore.getState().hydrate(now);
  return true;
}
