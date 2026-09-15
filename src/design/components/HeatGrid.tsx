import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { space } from '../tokens';
import { Text } from './Text';

export type HeatCell = {
  key: string;
  /** 0 = nothing, 1 = a full day. Quantized into four levels when drawn. */
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

const CELL = 28;
const GAP = 6;
const RING = 3;
/** Breathing room between the ring and the tinted square. */
const RING_GAP = 1;
const OUTER_RADIUS = CELL * 0.28;

/** Four levels read as levels; a continuous ramp reads as mud. Empty is an outline. */
function levelOpacity(intensity: number): number {
  if (intensity <= 0) {
    return 0;
  }
  if (intensity < 0.34) {
    return 0.4;
  }
  if (intensity < 0.67) {
    return 0.7;
  }
  return 1;
}

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
              <Text variant="caption" tone="secondary" align="center">
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.cells}>
        {cells.map((cell) => {
          const opacity = levelOpacity(cell.intensity);
          return (
            // The ring sits outside the tinted square, so it never fades with the cell.
            <View
              key={cell.key}
              style={[
                styles.slot,
                cell.today ? { borderColor: colors.ink, borderWidth: RING, padding: RING_GAP } : null,
              ]}
            >
              <View
                style={[
                  styles.cell,
                  // Concentric corners: the inner radius is the outer minus what sits between.
                  { borderRadius: cell.today ? Math.max(2, OUTER_RADIUS - RING - RING_GAP) : OUTER_RADIUS },
                  opacity === 0
                    ? { borderWidth: 1, borderColor: colors.inkTertiary }
                    : { backgroundColor: colors.ink, opacity },
                ]}
              />
            </View>
          );
        })}
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
  slot: {
    width: CELL,
    height: CELL,
    borderRadius: OUTER_RADIUS,
    padding: 0,
  },
  cell: {
    flex: 1,
  },
});
