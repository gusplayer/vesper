import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, shadow, space } from '../tokens';
import { Text } from './Text';

type HeroObjectProps = {
  /** Small: the onboarding tour and the session close. */
  size?: 'md' | 'lg';
};

/**
 * The object at the center of the home page — Brick renders its device, Vesper renders
 * its tile: a rounded square with the week grid from the app icon. Light on the page,
 * dark during a session; it lifts off the page with the hero shadow.
 */
export function HeroObject({ size = 'lg' }: HeroObjectProps) {
  const { colors, scheme } = useTheme();
  const side = size === 'lg' ? layout.hero : layout.hero * 0.6;
  const tile = colors.card;
  const cell = scheme === 'dark' ? colors.inkTertiary : colors.cardMuted;
  const cellLived = colors.ink;
  // Four columns whatever the size: the grid is sized from its cells, not the tile.
  const columns = 4;
  const cellSide = Math.round(side * 0.09);
  const gap = Math.max(2, Math.round(side * 0.03));
  const gridWidth = columns * cellSide + (columns - 1) * gap;

  return (
    <View
      style={[
        styles.tile,
        { width: side, height: side, borderRadius: side * 0.22, backgroundColor: tile, shadowColor: colors.shadow },
      ]}
    >
      <View style={[styles.grid, { width: gridWidth, gap }]}>
        {Array.from({ length: columns * columns }, (_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              { width: cellSide, height: cellSide, backgroundColor: i < 9 ? cellLived : cell },
            ]}
          />
        ))}
      </View>
      <Text variant="caption" weight="semibold" tone="secondary" style={styles.word}>
        VESPER
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: space.sm,
    ...shadow.hero,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    borderRadius: radius.sm / 4,
  },
  word: {
    letterSpacing: 2,
  },
});
