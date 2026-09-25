import type { BlockingStatus } from '../../platform/blockingTypes';

/**
 * Whether Android's exact-alarm toggle is off. Without it a routine window can open
 * up to ten minutes late, so the routines screen says so and offers the system page
 * (rule 8: where a capability is missing, the screen says why).
 *
 * `status()` of the blocking module carries the toggle in an optional `detail`; a
 * status without it (iOS, no module) is not "off", so nothing is claimed.
 */
export function exactAlarmsOff(status: BlockingStatus): boolean {
  return status.detail?.exactAlarm === false;
}
