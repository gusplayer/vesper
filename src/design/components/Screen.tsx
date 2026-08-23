import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '../tokens';

type ScreenProps = {
  children: ReactNode;
  /**
   * Lets the page scroll. Needed wherever Dynamic Type past 130% can overflow —
   * DESIGN_SYSTEM.md requires the home screen to scroll at that point.
   */
  scroll?: boolean;
};

/** Paper background and page margins. Every screen is wrapped in this. */
export function Screen({ children, scroll = false }: ScreenProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.paper,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: layout.pageMargin,
    paddingVertical: space.xl,
    // Screens stack children and never set their own gaps: spacing is decided here.
    rowGap: space.md,
  },
});
