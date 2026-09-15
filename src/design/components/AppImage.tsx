import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout } from '../tokens';

type AppImageProps = {
  /** A PNG, base64 without the data: prefix. Null draws a muted placeholder tile. */
  base64: string | null;
  accessibilityLabel?: string;
};

const SIDE = layout.appIcon.md;

/**
 * A real app icon, 40px with the same corner as AppIcon. Android hands us the bitmap
 * (iOS never does, ADR-0004), so this exists for the Android picker only and stays
 * out of the public index: platform views import it by relative path.
 */
export function AppImage({ base64, accessibilityLabel }: AppImageProps) {
  const { colors } = useTheme();
  if (base64 === null) {
    return <View style={[styles.tile, { backgroundColor: colors.cardMuted }]} />;
  }
  return (
    <Image
      source={{ uri: `data:image/png;base64,${base64}` }}
      style={styles.tile}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    width: SIDE,
    height: SIDE,
    borderRadius: SIDE * 0.24,
  },
});
