import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '../tokens';

type ScreenProps = {
  children: ReactNode;
};

/** Paper background and page margins. Every screen is wrapped in this. */
export function Screen({ children }: ScreenProps) {
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
    flex: 1,
    paddingHorizontal: layout.pageMargin,
    paddingVertical: space.xl,
    // Screens stack children and never set their own gaps: spacing is decided here.
    rowGap: space.md,
  },
});
