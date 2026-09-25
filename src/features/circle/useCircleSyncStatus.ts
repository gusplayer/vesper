import { useCircleStore } from '../../data';
import { isDemoCircle, status, type CircleSyncStatus } from '../../platform/circle';

/**
 * The circle's one line (`platform/circle.status()`), subscribed: it changes the moment a
 * sync lands or the demo seed goes, instead of on whatever render a screen does next.
 * Every circle screen shows it the same way.
 */
export function useCircleSyncStatus(): CircleSyncStatus {
  const account = useCircleStore((state) => state.account);
  const syncedAt = useCircleStore((state) => state.syncedAt);
  const syncFailed = useCircleStore((state) => state.syncFailed);
  const demo = useCircleStore(isDemoCircle);
  return status({ account, syncedAt, syncFailed, demo });
}

/** Whether the people on screen are the demo seed's (no account, seed still there). */
export function useIsDemoCircle(): boolean {
  const account = useCircleStore((state) => state.account);
  const demo = useCircleStore(isDemoCircle);
  return account === null && demo;
}
