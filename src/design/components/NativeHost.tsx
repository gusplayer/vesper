import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';

type NativeHostProps = {
  children: ReactNode;
};

/**
 * A fixed-height, muted box for a native view that sizes itself to its parent (the
 * Screen Time picker, say). The child fills it; the box gives it room, corners and a
 * background to sit on while the native side is still loading.
 *
 * Imported by relative path on purpose: it is a host for platform views, not a piece
 * of the design language, so it stays out of the public index.
 */
export function NativeHost({ children }: NativeHostProps) {
  const { colors } = useTheme();
  return <View style={[styles.host, { backgroundColor: colors.cardMuted }]}>{children}</View>;
}

const styles = StyleSheet.create({
  host: {
    height: layout.hero * 3,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
