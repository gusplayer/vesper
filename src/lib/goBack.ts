import type { router as expoRouter } from 'expo-router';

type Router = Pick<typeof expoRouter, 'back' | 'canGoBack' | 'replace'>;

/**
 * Going back when there may be nothing behind. A route reached by a deep link
 * (`vesper://circle/join?code=…`) or restored on a cold launch is the first one in
 * the stack, and `router.back()` there makes the navigator show the user its own
 * error: "The action 'GO_BACK' was not handled by any navigator".
 *
 * Focus is the fallback because it is the app's home: every tab route is reachable
 * from it, and it is where a launch with no history would have landed anyway.
 */
export function goBack(router: Router, fallback = '/'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
