import { useFocusEffect } from 'expo-router';
import { Pager } from '../design/components/Pager';
import { useRevision } from '../lib/useRevision';
import { Home } from '../screens/Home';
import { Life } from '../screens/Life';

/**
 * Pager host. Two pages: inicio and vida — the session is its own route, so it can
 * never be abandoned with a swipe. See docs/adr/0009-swipe-navigation.md.
 *
 * Always starts on inicio. Vida is never the initial page, the PRD requires it. It is
 * always present, though: with no birth date it shows an invitation, and there is no
 * onboarding where it could be declined (ADR-0012). Hiding it is a decision for later.
 */
export default function PagerHost() {
  const [revision, bump] = useRevision();

  // Coming back from a session changes the database, and the pages are not routes, so
  // they get no focus event of their own. This is that signal.
  useFocusEffect(bump);

  return (
    <Pager>
      <Home key="home" revision={revision} />
      <Life key="life" revision={revision} />
    </Pager>
  );
}
