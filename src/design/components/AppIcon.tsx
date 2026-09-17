import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { colors as palette, layout } from '../tokens';
import { Text } from './Text';

export type AppIconSize = 'sm' | 'md' | 'lg';

type AppIconProps = {
  /** First letter drawn on the tile. */
  initial: string;
  /** Brand-ish color of the fake app. Comes from the data layer, never from a screen. */
  color: string;
  size?: AppIconSize;
};

/**
 * A rounded tile standing in for an app icon. The prototype has no real app assets
 * (and iOS never gives us any — ADR-0004), so a colored square with a letter is what
 * every "app" looks like.
 *
 * The letter follows the tile, not the scheme: paper on a dark brand, ink on a light
 * one, so a black tile (TikTok, X) keeps its letter in the dark session too. In the
 * dark scheme the tile also gets a thin ring of the card color, so it keeps an edge
 * against the page.
 */
export function AppIcon({ initial, color, size = 'md' }: AppIconProps) {
  const { colors, scheme } = useTheme();
  const side = layout.appIcon[size];
  return (
    <View
      style={[
        styles.tile,
        {
          width: side,
          height: side,
          borderRadius: side * 0.24,
          backgroundColor: color,
          borderColor: scheme === 'dark' ? colors.cardMuted : color,
        },
      ]}
    >
      <Text
        variant={size === 'lg' ? 'heading' : size === 'md' ? 'body' : 'caption'}
        weight="semibold"
        style={{ color: isDark(color) ? palette.light.onInk : palette.light.ink }}
      >
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
