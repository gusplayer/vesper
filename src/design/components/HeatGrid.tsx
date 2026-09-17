import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { space } from '../tokens';
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
  cells: ReadonlyArray<HeatCell>;
  columns?: number;
  /** One letter per column, drawn above the first row. */
  columnLabels?: ReadonlyArray<string>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const CELL = 28;
const GAP = 6;
const RADIUS = CELL * 0.28;

/** Whether the system asked for less motion, kept current while mounted. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) {
          setReduced(value);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/**
 * Days as squares: the more focus, the more ink. Four weeks fit the home page and
 * read at a glance, which is what the middle of that page is for. The squares light
 * up one by one, in no order, when the grid appears (HeatSquare); today keeps breathing.
 */
export function HeatGrid({ cells, columns = 7, columnLabels, onPress, accessibilityLabel }: HeatGridProps) {
  const reduceMotion = useReduceMotion();
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
        {cells.map((cell) => (
          <HeatSquare
            key={cell.key}
            intensity={cell.intensity}
            today={cell.today === true}
            size={CELL}
            radius={RADIUS}
            reduceMotion={reduceMotion}
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
});
