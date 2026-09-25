import { useNavigationContainerRef, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAppStore } from '../../data';
import { takePendingInvite, usePendingLink } from '../../data/pendingLink';

const ONBOARDING_PREFIX = '/onboarding';

/**
 * Opens an invitation that arrived during the onboarding, once the onboarding ends.
 * `+native-intent` parks the code (`data/pendingLink`); the guard had sent the user
 * to the onboarding instead of `circle/join`. When the tour's "Listo" swaps the app
 * to the tabs, this pushes `circle/join?code=…` on top of Focus, so "Cerrar" lands on
 * the home page.
 *
 * A code parked while the onboarding was already done is dropped instead: the router
 * opened `circle/join` itself, and opening it twice would stack two copies.
 * Renders nothing. Mounted once, under the root layout, next to SessionGate.
 */
export function PendingInviteGate() {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const pathname = usePathname();
  const onboardingDone = useAppStore((state) => state.settings.onboardingDone);
  const inviteCode = usePendingLink((state) => state.inviteCode);
  // True while this launch has seen the onboarding unfinished and not yet acted on its end.
  const sawOnboarding = useRef(!onboardingDone);
  // The code to open as soon as the tabs are on screen.
  const toOpen = useRef<string | null>(null);

  useEffect(() => {
    if (!onboardingDone) {
      sawOnboarding.current = true;
      return;
    }
    const justFinished = sawOnboarding.current;
    sawOnboarding.current = false;
    if (inviteCode === null) {
      return;
    }
    const code = takePendingInvite();
    if (justFinished && code !== null) {
      toOpen.current = code;
    }
  }, [onboardingDone, inviteCode]);

  // Waits for the guard to leave the onboarding: a push while the onboarding stack is
  // still the one on screen would be swallowed by the swap.
  useEffect(() => {
    const code = toOpen.current;
    if (code === null || !onboardingDone || pathname.startsWith(ONBOARDING_PREFIX) || !navigation.isReady()) {
      return;
    }
    toOpen.current = null;
    router.push({ pathname: '/circle/join', params: { code } });
  }, [pathname, onboardingDone, navigation, router]);

  return null;
}
