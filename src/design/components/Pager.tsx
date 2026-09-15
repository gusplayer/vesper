import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';

type PagerProps = {
  children: ReactNode;
};

/**
 * The horizontal swipe between pages. Native paging (UIPageViewController /
 * ViewPager2): it follows the finger and animates nothing in JS — ADR-0009.
 *
 * Always starts on the first page. Each child needs a stable `key`.
 */
export function Pager({ children }: PagerProps) {
  return (
    <PagerView style={styles.pager} initialPage={0}>
      {children}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
});
