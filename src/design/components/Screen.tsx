import { useEffect, useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
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
  /**
   * A page with fields: the content and the pinned footer rise above the keyboard
   * instead of hiding under it, on iOS and on Android's edge-to-edge window alike.
   */
  avoidKeyboard?: boolean;
  /** When this changes the scroll goes back to the top: a view switch on the same page. */
  scrollResetKey?: string | number;
};

/** Page background, safe areas, side margins and an optional pinned footer. */
export function Screen({ children, scroll = false, footer, inTabs = false, avoidKeyboard = false, scrollResetKey }: ScreenProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollResetKey !== undefined) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [scrollResetKey]);

  const body = (
    <>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={avoidKeyboard ? 'interactive' : undefined}
          bounces={false}
          overScrollMode="never"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
      {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
    </>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={inTabs ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      {avoidKeyboard ? (
        // 'padding' on both platforms: under edge-to-edge Android no longer resizes the
        // window for the keyboard, so the view makes the room itself, as on iOS.
        <KeyboardAvoidingView style={styles.safe} behavior="padding">
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
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
