import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { space } from '../tokens';

type DotGridProps = {
  /** One flag per cell, in reading order. */
  cells: ReadonlyArray<boolean>;
  columns?: number;
  /** Cell side in points. Small for a life grid, larger for a month. */
  size?: number;
  gap?: number;
};

/**
 * A grid of filled and empty squares. The month heatmap of the activity tab and the
 * weeks-of-life grid are both this: filled means done, or lived.
 */
export function DotGrid({ cells, columns = 7, size = 14, gap = 3 }: DotGridProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.grid, { width: columns * (size + gap) - gap, gap }]}>
      {cells.map((filled, index) => (
        <View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.2,
            backgroundColor: filled ? colors.ink : colors.cardMuted,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: space.xs,
  },
});
