import type { CapabilityStatus } from '../../platform/capabilities';

/**
 * Whether Android's exact-alarm toggle is off. Without it a routine window can open
 * up to ten minutes late, so the routines screen says so and offers the system page
 * (rule 8: where a capability is missing, the screen says why).
 *
 * `status()` of the blocking module carries the toggle in an optional `detail`; a
 * status without it (iOS, no module) is not "off", so nothing is claimed.
 */
type StatusWithDetail = CapabilityStatus & { detail?: { exactAlarm?: boolean } };

export function exactAlarmsOff(status: CapabilityStatus): boolean {
  return (status as StatusWithDetail).detail?.exactAlarm === false;
}
