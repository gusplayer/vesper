import { memo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { color } from '../tokens';

const COLUMNS = 52;
const GAP = 1;

type WeekGridProps = {
  lived: number;
  total: number;
};

type RowProps = {
  /** How many of this row's cells are filled, 0 to COLUMNS. */
  filled: number;
  cells: number;
  size: number;
};

const Row = memo(function Row({ filled, cells, size }: RowProps) {
  const squares = [];
  for (let index = 0; index < cells; index += 1) {
    squares.push(
      <View
        key={index}
        style={[
          { width: size, height: size },
          index < filled ? styles.livedCell : styles.remainingCell,
        ]}
      />,
    );
  }
  return <View style={styles.row}>{squares}</View>;
});

/**
 * One square per week: lived in ink, remaining in ink30.
 *
 * This is the only thing in the app that looks like a chart, and it is allowed
 * because the squares are literally the filled boxes of the design language —
 * ADR-0006. It is not a visualization of a number, it is the number.
 */
export function WeekGrid({ lived, total }: WeekGridProps) {
  const [width, setWidth] = useState(0);

  function measure(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }

  // Cells are sized from the available width so 52 of them always fit the page.
  const size = width === 0 ? 0 : Math.max(1, Math.floor((width - (COLUMNS - 1) * GAP) / COLUMNS));
  const rowCount = Math.ceil(total / COLUMNS);
  const livedClamped = Math.min(Math.max(0, lived), total);

  const rows = [];
  if (size > 0) {
    for (let row = 0; row < rowCount; row += 1) {
      const start = row * COLUMNS;
      rows.push(
        <Row
          key={row}
          cells={Math.min(COLUMNS, total - start)}
          filled={Math.min(COLUMNS, Math.max(0, livedClamped - start))}
          size={size}
        />,
      );
    }
  }

  return (
    <View onLayout={measure} style={styles.grid}>
      {rows}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    rowGap: GAP,
  },
  row: {
    flexDirection: 'row',
    columnGap: GAP,
  },
  livedCell: {
    backgroundColor: color.ink,
  },
  remainingCell: {
    backgroundColor: color.ink30,
  },
});
