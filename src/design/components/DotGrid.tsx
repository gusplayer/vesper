import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme';
import { layout, opacity, space } from '../tokens';

type DotGridProps = {
  /** One flag per cell, in reading order. */
  cells: readonly boolean[];
  columns?: number;
  /**
   * A hairline between cells instead of a gap, for grids with thousands of them (the
   * weeks of life). Drawn as two SVG paths, not one view per cell.
   */
  dense?: boolean;
  /** Size the cells so `columns` of them span the available width, centred. */
  fill?: boolean;
  /** What VoiceOver reads for the whole grid: '2.340 semanas vividas de 4.160'. */
  accessibilityLabel?: string;
};

/** Two paths of squares: the filled cells and the empty ones. One shape each, whatever the count. */
function cellPaths(cells: readonly boolean[], columns: number, side: number, gap: number): { filled: string; empty: string } {
  const filled: string[] = [];
  const empty: string[] = [];
  const pitch = side + gap;
  cells.forEach((on, index) => {
    const x = (index % columns) * pitch;
    const y = Math.floor(index / columns) * pitch;
    (on ? filled : empty).push(`M${x} ${y}h${side}v${side}h${-side}z`);
  });
  return { filled: filled.join(''), empty: empty.join('') };
}

/**
 * A grid of filled and empty squares. The month heatmap of the activity tab and the
 * weeks-of-life grid are both this: filled means done, or lived. Empty cells stay
 * visible in both schemes, so the shape of what is left reads as clearly as what is
 * done. Filling a width, the grid is centred in it: flooring the cell side leaves a
 * few points over, and they split evenly on both sides.
 */
export const DotGrid = memo(function DotGrid({
  cells,
  columns = 7,
  dense = false,
  fill = false,
  accessibilityLabel,
}: DotGridProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const gap = dense ? layout.dotGrid.denseGap : layout.dotGrid.gap;

  const side = fill
    ? width === 0
      ? 0
      : Math.max(1, Math.floor((width - (columns - 1) * gap) / columns))
    : layout.dotGrid.size;
  const rows = Math.ceil(cells.length / columns);
  const gridWidth = side === 0 ? 0 : columns * side + (columns - 1) * gap;
  const gridHeight = side === 0 ? 0 : rows * side + Math.max(0, rows - 1) * gap;

  const paths = useMemo(
    () => (dense && side > 0 ? cellPaths(cells, columns, side, gap) : null),
    [dense, cells, columns, side, gap],
  );

  function measure(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }

  const grid =
    side === 0 ? null : paths !== null ? (
      <Svg width={gridWidth} height={gridHeight}>
        <Path d={paths.empty} fill={colors.inkTertiary} opacity={opacity.emptyCell} />
        <Path d={paths.filled} fill={colors.ink} />
      </Svg>
    ) : (
      <View style={[styles.grid, { gap, width: gridWidth }]}>
        {cells.map((filled, index) => (
          <View
            key={index}
            style={[
              {
                width: side,
                height: side,
                borderRadius: Math.max(1, side * layout.dotGrid.cornerRatio),
                backgroundColor: filled ? colors.ink : colors.inkTertiary,
              },
              filled ? null : styles.empty,
            ]}
          />
        ))}
      </View>
    );

  return (
    <View
      onLayout={fill ? measure : undefined}
      style={[styles.frame, fill ? styles.fill : null]}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel === undefined ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
    >
      {grid}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    marginVertical: space.xs,
  },
  fill: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  empty: {
    opacity: opacity.emptyCell,
  },
});
