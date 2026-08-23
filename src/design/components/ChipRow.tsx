import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';

type ChipRowProps = {
  children: ReactNode;
};

/**
 * A wrapping row of chips. Exists because screens are not allowed to import tokens,
 * so the gap between options is a design decision made here and nowhere else.
 */
export function ChipRow({ children }: ChipRowProps) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: space.sm,
  },
});
