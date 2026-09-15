import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '../theme';
import { space } from '../tokens';

type DotGridProps = {
  /** One flag per cell, in reading order. */
  cells: ReadonlyArray<boolean>;
  columns?: number;
  /** Cell side in points when not filling. */
  size?: number;
  gap?: number;
  /** Size the cells so `columns` of them span the available width exactly. */
  fill?: boolean;
};

/**
 * A grid of filled and empty squares. The month heatmap of the activity tab and the
 * weeks-of-life grid are both this: filled means done, or lived. Empty cells stay
 * visible in both schemes, so the shape of what is left reads as clearly as what is
 * done.
 */
export function DotGrid({ cells, columns = 7, size = 14, gap = 3, fill = false }: DotGridProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const side = fill
    ? width === 0
      ? 0
      : Math.max(1, Math.floor((width - (columns - 1) * gap) / columns))
    : size;

  function measure(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={fill ? measure : undefined}
      style={[styles.grid, { gap }, fill ? styles.fill : { width: columns * (size + gap) - gap }]}
    >
      {side === 0
        ? null
        : cells.map((filled, index) => (
            <View
              key={index}
              style={[
                {
                  width: side,
                  height: side,
                  borderRadius: Math.max(1, side * 0.2),
                  backgroundColor: filled ? colors.ink : colors.inkTertiary,
                },
                filled ? null : styles.empty,
              ]}
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
  fill: {
    alignSelf: 'stretch',
  },
  empty: {
    opacity: 0.35,
  },
});
