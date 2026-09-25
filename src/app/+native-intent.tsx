import { inviteCodeFromPath, usePendingLink } from '../data/pendingLink';

/**
 * Every path the OS hands to the app goes through here first (expo-router
 * `+native-intent`, native only). It runs outside the app's context — it cannot
 * know whether the onboarding is done — so it never redirects: an invitation's code
 * is parked in `pendingLink` and the path goes on unchanged. If the onboarding is
 * done the router opens `circle/join` itself and `PendingInviteGate` drops the parked
 * copy; if not, the guard sends the user to the onboarding and the gate opens the
 * invitation when it ends.
 *
 * It must never throw (the docs are explicit): a failure here returns the path as
 * it came.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const code = inviteCodeFromPath(path);
    if (code !== null) {
      usePendingLink.getState().setInviteCode(code);
    }
  } catch {
    // Parking the code is a nicety; losing it is what happened before.
  }
  return path;
}
