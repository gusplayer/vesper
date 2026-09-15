import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { color, layout } from '../tokens';

type WeekGridRowProps = {
  /** How many of this row's cells are filled, 0 to cells. */
  filled: number;
  cells: number;
  size: number;
};

/** One row of the week grid. Memoised: the grid has ~78 rows and they never change. */
export const WeekGridRow = memo(function WeekGridRow({ filled, cells, size }: WeekGridRowProps) {
  const squares = [];
  for (let index = 0; index < cells; index += 1) {
    squares.push(
      <View
        key={index}
        style={[{ width: size, height: size }, index < filled ? styles.lived : styles.remaining]}
      />,
    );
  }
  return <View style={styles.row}>{squares}</View>;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    columnGap: layout.gridGap,
  },
  lived: {
    backgroundColor: color.ink,
  },
  remaining: {
    backgroundColor: color.ink30,
  },
});
