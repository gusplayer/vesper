import { useStreakSettle } from './useStreakSettle';

/** Mounts the streak settling once, under the root layout, next to SessionGate. Renders nothing. */
export function StreakSettle() {
  useStreakSettle();
  return null;
}
