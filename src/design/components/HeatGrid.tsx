import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Text } from './Text';

export type HeatCell = {
  key: string;
  /** 0 = nothing, 1 = a full day. Drawn as ink opacity. */
  intensity: number;
  /** Today gets a ring so the grid has a "you are here". */
  today?: boolean;
};

type HeatGridProps = {
  /** Reading order, oldest first, `columns` per row. */
  cells: ReadonlyArray<HeatCell>;
  columns?: number;
  /** One letter per column, drawn above the first row. */
  columnLabels?: ReadonlyArray<string>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const CELL = 30;
const GAP = 6;

/**
 * Days as squares: the more focus, the more ink. Four weeks fit the home page and
 * read at a glance, which is what the middle of that page is for.
 */
export function HeatGrid({ cells, columns = 7, columnLabels, onPress, accessibilityLabel }: HeatGridProps) {
  const { colors } = useTheme();
  const width = columns * CELL + (columns - 1) * GAP;

  const grid = (
    <View style={[styles.wrap, { width }]}>
      {columnLabels === undefined ? null : (
        <View style={styles.labels}>
          {columnLabels.map((label, index) => (
            <View key={index} style={styles.labelCell}>
              <Text variant="caption" tone="tertiary" align="center">
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.cells}>
        {cells.map((cell) => (
          <View
            key={cell.key}
            style={[
              styles.cell,
              {
                backgroundColor: colors.ink,
                opacity: 0.1 + 0.9 * Math.min(1, Math.max(0, cell.intensity)),
              },
              cell.today ? { borderWidth: 2, borderColor: colors.inkSecondary, opacity: Math.max(0.3, 0.1 + 0.9 * cell.intensity) } : null,
            ]}
          />
        ))}
      </View>
    </View>
  );

  if (onPress === undefined) {
    return grid;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {grid}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    rowGap: space.sm,
  },
  labels: {
    flexDirection: 'row',
    columnGap: GAP,
  },
  labelCell: {
    width: CELL,
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: radius.sm / 2,
  },
});
