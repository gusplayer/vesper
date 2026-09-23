import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { colors as palette, layout } from '../tokens';
import { Text } from './Text';

export type AppTileSize = 'sm' | 'md' | 'lg';

type AppTileProps = {
  /** The real icon as a PNG, base64 without the data: prefix. Android gives one; iOS never does (ADR-0004). */
  icon?: string | null;
  /** Drawn on the tile when there is no icon. */
  initial: string;
  /** Brand-ish color of a catalogue app, from the data layer. Null draws a muted tile. */
  color?: string | null;
  size?: AppTileSize;
  accessibilityLabel?: string;
};

/**
 * The one way an app looks (ADR-0029): the real icon where the platform hands it
 * over, otherwise a rounded tile with a letter. The prototype's catalogue has brand
 * colors for its tiles; a real app without an icon gets the muted card color.
 *
 * The letter follows the tile, not the scheme: paper on a dark brand, ink on a light
 * one, so a black tile (TikTok, X) keeps its letter in the dark session too. In the
 * dark scheme the tile also gets a thin ring of the card color, so it keeps an edge
 * against the page.
 */
export function AppTile({ icon = null, initial, color = null, size = 'md', accessibilityLabel }: AppTileProps) {
  const { colors, scheme } = useTheme();
  const side = layout.appIcon[size];
  const shape = { width: side, height: side, borderRadius: side * 0.24 };

  if (icon !== null) {
    return (
      <Image
        source={{ uri: `data:image/png;base64,${icon}` }}
        style={shape}
        accessibilityLabel={accessibilityLabel}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const fill = color ?? colors.cardMuted;
  const letter = color === null ? colors.ink : isDark(color) ? palette.light.onInk : palette.light.ink;
  return (
    <View
      style={[styles.tile, shape, { backgroundColor: fill, borderColor: scheme === 'dark' ? colors.cardMuted : fill }]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text variant={size === 'lg' ? 'heading' : size === 'md' ? 'body' : 'caption'} weight="semibold" style={{ color: letter }}>
        {initial}
      </Text>
    </View>
  );
}

/** Perceived luminance of a '#rrggbb' brand color, below the midpoint. Unparseable reads as dark. */
function isDark(hex: string): boolean {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) {
    return true;
  }
  const value = parseInt(match[1] ?? '000000', 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
