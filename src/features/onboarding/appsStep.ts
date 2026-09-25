import type { BlockingStatus } from '../../platform/blockingTypes';

/**
 * Which one list the onboarding's apps step shows (ADR-0047 §2: one app list per
 * mode, the same as the mode editor):
 *
 * - `real`: blocking is granted, so the step is the real picker (Screen Time's own on
 *   iOS, the phone's apps on Android). Its selection token is the mode's only list.
 * - `notGranted`: this phone has a real picker, but the access was skipped or refused
 *   (iOS not asked yet or refused, Android's Settings toggles off). The step says so
 *   neutrally and picks nothing: the mode blocks no apps until the access exists, and
 *   then its apps are chosen from the mode.
 * - `example`: there is no real picker here (a simulator, iOS without Apple's
 *   entitlement, a build without the module). Only then the catalogue, labelled as an
 *   example, with the platform's reason once at the top.
 *
 * Pure: the screen passes `status()` and `isAuthorized()`. An iOS refusal is
 * `detail.denied`, the one reason that is a permission rather than a fact.
 */
export type AppsStepKind = 'real' | 'notGranted' | 'example';

export function appsStepKind(blocking: BlockingStatus, authorized: boolean): AppsStepKind {
  if (authorized) {
    return 'real';
  }
  // iOS before it was asked: the phone can block, nobody has said yes yet.
  if (blocking.available) {
    return 'notGranted';
  }
  // Android with a Settings toggle off, or iOS after a no: both can still be granted.
  if (blocking.detail?.missing !== undefined || blocking.detail?.denied === true) {
    return 'notGranted';
  }
  return 'example';
}
