import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';

type ColumnsProps = {
  children: ReactNode;
  /** How many children share a row. */
  count?: number;
};

/** Children laid out in equal columns, wrapping to new rows. Two months side by side. */
export function Columns({ children, count = 2 }: ColumnsProps) {
  const items = Children.toArray(children);
  return (
    <View style={styles.row}>
      {items.map((child, index) => (
        <View key={index} style={{ width: `${100 / count}%` }}>
          <View style={styles.cell}>{child}</View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -space.sm,
  },
  cell: {
    paddingHorizontal: space.sm,
    paddingBottom: space.lg,
  },
});
