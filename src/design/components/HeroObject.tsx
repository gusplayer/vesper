import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, shadow, space, font } from '../tokens';
import { Mark } from './Mark';
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
  // Four columns whatever the size: the grid is sized from its cells, not the tile.
  const cellSide = Math.round(side * 0.09);
  const gap = Math.max(2, Math.round(side * 0.03));

  return (
    <View
      style={[
        styles.tile,
        { width: side, height: side, borderRadius: side * 0.22, backgroundColor: tile, shadowColor: colors.shadow },
      ]}
    >
      <Mark cell={cellSide} gap={gap} rest={scheme === 'dark' ? 'tertiary' : 'muted'} />
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
  word: {
    letterSpacing: font.tracking.mark,
  },
});
