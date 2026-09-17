import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, space } from '../tokens';

type ScreenProps = {
  children: ReactNode;
  /** Scrolls when true. Tabs and lists scroll; the home page and the session do not. */
  scroll?: boolean;
  /** Something pinned to the bottom: a primary button, an onboarding footer. */
  footer?: ReactNode;
  /** Skip the bottom safe area, for screens that sit above the tab bar. */
  inTabs?: boolean;
};

/** Page background, safe areas, side margins and an optional pinned footer. */
export function Screen({ children, scroll = false, footer, inTabs = false }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={inTabs ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
      {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    paddingHorizontal: layout.pageMargin,
    rowGap: space.lg,
  },
  footer: {
    paddingTop: space.md,
    paddingBottom: space.md,
    paddingHorizontal: layout.pageMargin,
    rowGap: space.md,
  },
});
