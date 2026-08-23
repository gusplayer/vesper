import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';

import { Home } from '../screens/Home';
import { Life } from '../screens/Life';

/**
 * Pager host. Two pages: inicio and vida — the session is its own route, so it can
 * never be abandoned with a swipe. See docs/adr/0009-swipe-navigation.md.
 *
 * Always starts on inicio. Vida is never the initial page, the PRD requires it.
 *
 * TODO: hide the vida page when onboarding exists and the user opted out. Today the
 * page invites instead: without a birth date it shows nothing to be anxious about.
 */
export default function PagerHost() {
  const [revision, setRevision] = useState(0);

  // Coming back from a session changes the database, and the pages are not routes, so
  // they get no focus event of their own. This is that signal.
  useFocusEffect(
    useCallback(() => {
      setRevision((current) => current + 1);
    }, []),
  );

  return (
    <PagerView style={styles.pager} initialPage={0}>
      <Home key="home" revision={revision} />
      <Life key="life" revision={revision} />
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
