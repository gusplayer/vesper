import { useBlockingSync } from './hooks/useBlockingSync';
import { useCircleSync } from './hooks/useCircleSync';
import { useHealthSync } from './hooks/useHealthSync';
import { useLiveActivitySync } from './hooks/useLiveActivitySync';
import { useNotificationSync } from './hooks/useNotificationSync';
import { usePushSync } from './hooks/usePushSync';
import { useRoutineSync } from './hooks/useRoutineSync';
import { useRoutineWindowsSync } from './hooks/useRoutineWindowsSync';
import { useUsageSync } from './hooks/useUsageSync';

/**
 * Mounts every platform side effect once, under the root layout. Each hook watches a
 * store and talks to one native capability; none of them renders anything.
 */
export function PlatformEffects() {
  useNotificationSync();
  usePushSync();
  useHealthSync();
  useLiveActivitySync();
  useBlockingSync();
  useRoutineSync();
  useRoutineWindowsSync();
  useUsageSync();
  useCircleSync();
  return null;
}
