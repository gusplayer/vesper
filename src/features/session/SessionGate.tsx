import { useNavigationContainerRef, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useFocusStore } from '../../data';
import { breakEndsAt, plannedEndAt } from '../../domain/session';

const SESSION_PREFIX = '/session';
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
 *
 * The exact moments are scheduled once; on foreground the clock is read again
 * because timers sleep in the background. Renders nothing. Mounted once, under the
 * root layout.
 */
export function SessionGate() {
  const router = useRouter();
  const navigation = useNavigationContainerRef();
  const pathname = usePathname();
  const session = useFocusStore((state) => state.session);
  const settleNow = useFocusStore((state) => state.settleNow);
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
    if (sessionId === null || insideSession()) {
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
    // Re-checked when the session changes or when the path leaves the session routes.
  }, [sessionId, pathname, navigation, router]);

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
      if (settled === null || settled.outcome === 'running') {
        return;
      }
      if (insideSession()) {
        router.replace('/session/complete');
      } else {
        router.push('/session/complete');
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
  }, [sessionId, endAt, breakEnd, settleNow, router]);

  return null;
}
