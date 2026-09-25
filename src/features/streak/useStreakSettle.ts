import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data';

/**
 * Settles the streak whenever the app is looked at (ADR-0027): stamps the moment
 * it was opened, bridges the days missed since with grace and refills the emergency
 * unlocks when the month changed, on mount and on every return to the foreground. Mounted once in the root layout, next to SessionGate.
 */
export function useStreakSettle(): void {
  useEffect(() => {
    const settle = (): void => {
      const now = Date.now();
      const app = useAppStore.getState();
      app.markOpened(now);
      app.settleStreak(now);
      // The emergency unlocks refill with the month; a phone left open across the 1st
      // gets them back on its next return, not only at the next boot.
      app.settleEmergency(now);
    };
    settle();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        settle();
      }
    });
    return () => subscription.remove();
  }, []);
}
