import { useBlockingSync } from './hooks/useBlockingSync';
import { useHealthSync } from './hooks/useHealthSync';
import { useLiveActivitySync } from './hooks/useLiveActivitySync';
import { useNotificationSync } from './hooks/useNotificationSync';

/**
 * Mounts every platform side effect once, under the root layout. Each hook watches a
 * store and talks to one native capability; none of them renders anything.
 */
export function PlatformEffects() {
  useNotificationSync();
  useHealthSync();
  useLiveActivitySync();
  useBlockingSync();
  return null;
}
