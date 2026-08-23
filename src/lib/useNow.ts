import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A clock that ticks. Returns Date.now() refreshed every intervalMs, and refreshes
 * immediately when the app comes back to the foreground, because timers are computed
 * from `now - startedAt` and a stale `now` would show a frozen clock for one tick.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
