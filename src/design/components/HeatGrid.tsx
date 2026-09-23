import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { HeatSquare } from './HeatSquare';
import { Text } from './Text';

export type HeatCell = {
  key: string;
  /** 0 = nothing, 1 = a full day. Quantized into four levels when drawn. */
  intensity: number;
  /** Today keeps breathing so the grid has a "you are here". */
  today?: boolean;
};

type HeatGridProps = {
  /** Reading order, oldest first, `columns` per row. */
  cells: readonly HeatCell[];
  columns?: number;
  /** One letter per column, drawn above the first row. */
  columnLabels?: readonly string[];
  onPress?: () => void;
  accessibilityLabel?: string;
  /**
   * 'md' is the four weeks on the home page. 'sm' is a single week beside text — a
   * challenge's seven days — where full-size squares would outshout the line they
   * belong to.
   */
  size?: 'sm' | 'md';
  /**
   * 'md' keeps the small squares on the big grid's columns: same seven column centres,
   * same total width, smaller marks. A week drawn under another week has to line up
   * with it or the two read as unrelated things that happen to be near each other.
   */
  pitch?: 'own' | 'md';
};

const CELL = 28;
const SMALL_CELL = 16;
const GAP = 6;
const SMALL_GAP = 4;
const RADIUS_RATIO = 0.28;

/**
 * Days as squares: the more focus, the more ink. Four weeks fit the home page and
 * read at a glance, which is what the middle of that page is for. The squares light
 * up one by one, in no order, when the grid appears (HeatSquare); today keeps breathing.
 */
export function HeatGrid({
  cells,
  columns = 7,
  columnLabels,
  onPress,
  accessibilityLabel,
  size = 'md',
  pitch = 'own',
}: HeatGridProps) {
  const reduceMotion = useReduceMotion();
  const cell = size === 'md' ? CELL : SMALL_CELL;
  // The slot is what a column occupies; the cell is what is drawn inside it.
  const slot = pitch === 'md' ? CELL : cell;
  const gap = pitch === 'md' || size === 'md' ? GAP : SMALL_GAP;
  const width = columns * slot + (columns - 1) * gap;

  const grid = (
    <View style={[styles.wrap, { width }]}>
      {columnLabels === undefined ? null : (
        <View style={[styles.labels, { columnGap: gap }]}>
          {columnLabels.map((label, index) => (
            <View key={index} style={{ width: slot }}>
              <Text variant="caption" tone="secondary" align="center">
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={[styles.cells, { gap }]}>
        {cells.map((day) => (
          <View key={day.key} style={[styles.slot, { width: slot }]}>
            <HeatSquare
              intensity={day.intensity}
              today={day.today === true}
              size={cell}
              radius={cell * RADIUS_RATIO}
              reduceMotion={reduceMotion}
            />
          </View>
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
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  slot: {
    alignItems: 'center',
  },
});
