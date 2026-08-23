import PagerView from 'react-native-pager-view';
import { StyleSheet } from 'react-native';

import { Home } from '../screens/Home';
import { Life } from '../screens/Life';

/**
 * Pager host. Two pages: inicio and vida — the session is its own route, so it can
 * never be abandoned with a swipe. See docs/adr/0009-swipe-navigation.md.
 *
 * Always starts on inicio. Vida is never the initial page, the PRD requires it.
 *
 * TODO: hide the vida page when settings.life_screen_enabled is false. Needs the
 * settings repository (docs/SPRINT_01.md task 3).
 */
export default function PagerHost() {
  return (
    <PagerView style={styles.pager} initialPage={0}>
      <Home key="home" />
      <Life key="life" />
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
