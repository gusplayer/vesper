import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useFocusStore } from '../../data/stores/focus';
import { takeShieldEvents } from '../blocking';

/**
 * Brings what the shield saw into the database (ADR-0053) whenever the app comes back
 * to the foreground: attempts, taps on "Volver al foco", and breaks taken from the
 * shield, which the focus store takes into the running session at the instant of the
 * tap. Boot drains the queue on its own, before any session is settled; SessionGate
 * drains it before each settle. This covers the rest: the queue of a session already
 * over, or a return with nothing to settle. Draining twice is harmless: the native
 * queue empties on every take.
 */
export function useShieldSync(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useFocusStore.getState().ingestShield(takeShieldEvents());
      }
    });
    return () => subscription.remove();
  }, []);
}
