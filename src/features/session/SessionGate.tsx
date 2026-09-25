import { useNavigationContainerRef, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAppStore, useFocusStore } from '../../data';
import { breakEndsAt, plannedEndAt } from '../../domain/session';

const SESSION_PREFIX = '/session';
const COMPLETE_PATH = '/session/complete';
/** How often to look again while the navigator is still mounting. */
const READY_POLL_MS = 50;

/**
 * The session's keeper outside its own screen. The store is the source of truth for
 * "a session is running"; the route is not. Three jobs follow from that:
 *
 * - A running session pulls the app into `/session/active`. After a relaunch the store
 *   hydrates but the router opens on the tabs; when a routine starts a session by
 *   itself the engine writes the store and navigates nowhere. Either way Focus would
 *   sit there saying "Seguir" about a session the user never chose to leave (ADR-0009,
 *   ADR-0016: the session is a full-screen route with no way back).
 * - A session that runs out closes even if its screen is not mounted, so nothing
 *   keeps counting a session that is over. A chosen duration completes; an open
 *   session at its cap expires (ADR-0022).
 * - A break that runs out ends by itself, and the session goes on.
 * - A session that ran out while the app was dead was closed by boot, silently. Its
 *   closing is shown once, on this open (ADR-0047 §9): the store marks it owed.
 *
 * The exact moments are scheduled once; on foreground the clock is read again
 * because timers sleep in the background. Renders nothing. Mounted once, under the
 * root layout.
 *
 * Until onboarding is done it navigates nowhere: the session routes sit behind the
 * `onboardingDone` guard, so a push there would bounce back to the onboarding on every
 * path change. A session that is due still closes; only the screen change waits.
 */
export function SessionGate() {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const pathname = usePathname();
  const onboardingDone = useAppStore((state) => state.settings.onboardingDone);
  const session = useFocusStore((state) => state.session);
  const settleNow = useFocusStore((state) => state.settleNow);
  const unseenClosing = useFocusStore((state) => state.unseenClosing);
  const closingSeen = useFocusStore((state) => state.closingSeen);
  const sessionId = session?.id ?? null;
  const endAt = session === null ? null : plannedEndAt(session);
  const breakEnd = session === null ? null : breakEndsAt(session);

  // The latest path, without re-running the effects every time it changes. Written in
  // an effect, declared first so it lands before the two below read it.
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const insideSession = () => pathRef.current.startsWith(SESSION_PREFIX);

  // Pull into the session whenever one is running and the app is somewhere else.
  useEffect(() => {
    if (!onboardingDone || sessionId === null || insideSession()) {
      return undefined;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const go = () => {
      if (!navigation.isReady()) {
        return false;
      }
      if (!insideSession()) {
        router.push('/session/active');
      }
      return true;
    };
    if (!go()) {
      timer = setInterval(() => {
        if (go() && timer !== null) {
          clearInterval(timer);
        }
      }, READY_POLL_MS);
    }
    return () => {
      if (timer !== null) {
        clearInterval(timer);
      }
    };
    // Re-checked when the session changes, when the path leaves the session routes, and
    // when onboarding finishes with a session already running.
  }, [onboardingDone, sessionId, pathname, navigation, router]);

  // Show the closing nobody saw, once, as soon as the navigator can.
  useEffect(() => {
    if (!onboardingDone || !unseenClosing || sessionId !== null) {
      return undefined;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const go = () => {
      if (!navigation.isReady()) {
        return false;
      }
      closingSeen();
      if (!pathRef.current.startsWith(COMPLETE_PATH)) {
        router.push(COMPLETE_PATH);
      }
      return true;
    };
    if (!go()) {
      timer = setInterval(() => {
        if (go() && timer !== null) {
          clearInterval(timer);
        }
      }, READY_POLL_MS);
    }
    return () => {
      if (timer !== null) {
        clearInterval(timer);
      }
    };
  }, [onboardingDone, unseenClosing, sessionId, navigation, router, closingSeen]);

  // End the session the moment its time is up, or the break the moment it is over.
  useEffect(() => {
    if (sessionId === null) {
      return undefined;
    }
    const check = () => {
      const current = useFocusStore.getState().session;
      if (current === null || current.id !== sessionId) {
        return;
      }
      // One verdict for boot and foreground (ADR-0026): the store settles the break
      // past its length and the session past its end, at that end, not at now.
      const settled = settleNow(Date.now());
      if (settled === null || settled.outcome === 'running' || !onboardingDone) {
        return;
      }
      if (insideSession()) {
        router.replace(COMPLETE_PATH);
      } else {
        router.push(COMPLETE_PATH);
      }
    };
    const at = breakEnd ?? endAt;
    const timer = at === null ? null : setTimeout(check, Math.max(0, at - Date.now()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check();
      }
    });
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      subscription.remove();
    };
  }, [onboardingDone, sessionId, endAt, breakEnd, settleNow, router]);

  return null;
}
