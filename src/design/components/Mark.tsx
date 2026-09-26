import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius } from '../tokens';

const COLUMNS = 4;
const CELLS = COLUMNS * COLUMNS;
/** The cells the icon draws in ink: the lived part of the grid. */
const LIVED = 9;

type MarkProps = {
  /** A cell's side and the room between two, in points: the grid is sized from its cells. */
  cell: number;
  gap: number;
  /**
   * The seven cells not lived: 'tertiary' (`inkTertiary`), the mark on the page or in
   * ink; 'muted' (`cardMuted`), inside the light tile of HeroObject.
   */
  rest?: 'tertiary' | 'muted';
  /** The cell's corner; the system's small corner by default. */
  corner?: number;
};

/**
 * Vesper's mark (ADR-0028): the four by four grid of the app icon, nine cells in ink and
 * seven quiet. It is the icon, the object of the home page, the last image of the boot
 * and the signature of a shared image (ADR-0030). Still: the grids that move
 * (BreathingObject) draw their own. Internal: HeroObject, BootReveal and AlbumCard draw
 * with it, and it is not exported.
 */
export function Mark({ cell, gap, rest = 'tertiary', corner = radius.sm / 4 }: MarkProps) {
  const { colors } = useTheme();
  const off = rest === 'muted' ? colors.cardMuted : colors.inkTertiary;
  const width = COLUMNS * cell + (COLUMNS - 1) * gap;

  return (
    <View style={[styles.grid, { width, gap }]}>
      {Array.from({ length: CELLS }, (_, i) => (
        <View
          key={i}
          style={{ width: cell, height: cell, borderRadius: corner, backgroundColor: i < LIVED ? colors.ink : off }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
