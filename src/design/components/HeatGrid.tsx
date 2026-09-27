import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { HeatSquare } from './HeatSquare';
import { Tappable } from './Tappable';
import { Text } from './Text';

export type HeatCell = {
  key: string;
  /** 0 = nothing, 1 = a full day. Quantized into four levels when drawn. */
  intensity: number;
  /** Today keeps breathing so the grid has a "you are here". */
  today?: boolean;
  /**
   * A thumbnail inside the square (a file:// uri), drawn quiet under the veil: a photo
   * pinned to that day's mark (ADR-0051). Meant for 'lg', where it is big enough to read.
   */
  image?: string | null;
  /**
   * A photo is pinned to this day and is not on this phone yet (it downloads when the
   * challenge opens): the square holds the waiting fill of `PhotoTile` until `image`
   * arrives. It is a place held, never a dot of "new" (ADR-0051 §8).
   */
  waiting?: boolean;
  /**
   * This one square opens something (the photo). Its touch area reaches 44 pt. Ignored
   * when the whole grid has an `onPress`: a tap cannot mean two things.
   */
  onPress?: () => void;
  /** What VoiceOver reads for a square that opens something. */
  accessibilityLabel?: string;
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
   * belong to. 'lg' is your week on a challenge's page, big enough to hold the photo
   * of a day (ADR-0051).
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 'md' keeps the small squares on the big grid's columns: same seven column centres,
   * same total width, smaller marks. A week drawn under another week has to line up
   * with it or the two read as unrelated things that happen to be near each other.
   */
  pitch?: 'own' | 'md';
};

const CELL: Record<NonNullable<HeatGridProps['size']>, number> = {
  sm: layout.heatGrid.sm,
  md: layout.heatGrid.md,
  lg: layout.photo.cell,
};

/**
 * Days as squares: the more focus, the more ink. Four weeks fit the home page and
 * read at a glance, which is what the middle of that page is for. The squares light
 * up one by one, in no order, when the grid appears (HeatSquare); today keeps breathing.
 *
 * On a challenge's page the week is 'lg', and a marked day with a photo holds its
 * thumbnail, quiet under the veil, and opens it (ADR-0051); one still on its way holds
 * the waiting fill. The mark is still what the square says: the photo only sits on top
 * of it.
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
  const cell = CELL[size];
  // The slot is what a column occupies; the cell is what is drawn inside it.
  const slot = pitch === 'md' ? Math.max(CELL.md, cell) : cell;
  const gap = pitch === 'md' || size !== 'sm' ? layout.heatGrid.gap : layout.heatGrid.smallGap;
  const width = columns * slot + (columns - 1) * gap;
  const corner = cell * layout.heatGrid.cornerRatio;

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
        {cells.map((day) => {
          const square = (
            <HeatSquare
              intensity={day.intensity}
              today={day.today === true}
              size={cell}
              radius={corner}
              reduceMotion={reduceMotion}
              image={day.image ?? null}
              waiting={day.waiting === true}
            />
          );
          return (
            <View key={day.key} style={[styles.slot, { width: slot }]}>
              {onPress === undefined && day.onPress !== undefined ? (
                <Tappable onPress={day.onPress} accessibilityLabel={day.accessibilityLabel ?? ''}>
                  {square}
                </Tappable>
              ) : (
                square
              )}
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
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  slot: {
    alignItems: 'center',
  },
});
