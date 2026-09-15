import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { GRID_COLUMNS, cellSize, weekGridRows } from '../../domain/life';
import { layout } from '../tokens';
import { WeekGridRow } from './WeekGridRow';

type WeekGridProps = {
  lived: number;
  total: number;
};

/**
 * One square per week: lived in ink, remaining in ink30.
 *
 * This is the only thing in the app that looks like a chart, and it is allowed
 * because the squares are literally the filled boxes of the design language —
 * ADR-0006. It is not a visualization of a number, it is the number.
 *
 * The row math is pure and lives in domain/life.ts; this component only measures the
 * page width so 52 cells always fit it.
 */
export function WeekGrid({ lived, total }: WeekGridProps) {
  const [width, setWidth] = useState(0);

  function measure(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }

  const size = cellSize(width, GRID_COLUMNS, layout.gridGap);

  return (
    <View onLayout={measure} style={styles.grid}>
      {size === 0
        ? null
        : weekGridRows(lived, total).map((row, index) => (
            <WeekGridRow key={index} cells={row.cells} filled={row.filled} size={size} />
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    rowGap: layout.gridGap,
  },
});
