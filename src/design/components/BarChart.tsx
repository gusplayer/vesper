import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Text } from './Text';

export type Bar = {
  key: string;
  /** Under the bar: 'lun', '8'. Empty string hides it. */
  label: string;
  /** A second line under the label, e.g. the day number. */
  sublabel?: string;
  value: number;
  /** Today reads lighter, like Brick's. */
  highlight?: boolean;
};

type BarChartProps = {
  bars: ReadonlyArray<Bar>;
  /** Two dotted guide lines with a label on the right: [{ value, label }]. */
  guides?: ReadonlyArray<{ value: number; label: string }>;
  /** The 'PROM' pill on the right at this value. */
  average?: number;
  height?: number;
};

/**
 * Vertical bars drawn with Views, no chart library. Scale is the max of bars, guides
 * and the average, so nothing ever overflows. Bars are ink; a highlighted one is
 * secondary ink.
 */
export function BarChart({ bars, guides = [], average, height = 160 }: BarChartProps) {
  const { colors } = useTheme();
  const max = Math.max(
    1,
    ...bars.map((bar) => bar.value),
    ...guides.map((guide) => guide.value),
    average ?? 0,
  );
  const scale = (value: number) => (value / max) * height;

  return (
    <View style={styles.chart}>
      <View style={[styles.plot, { height }]}>
        {guides.map((guide) => (
          <View key={guide.label} style={[styles.guide, { bottom: scale(guide.value) }]}>
            <View style={[styles.guideLine, { borderColor: colors.line }]} />
            <Text variant="caption" tone="tertiary">
              {guide.label}
            </Text>
          </View>
        ))}
        {average === undefined ? null : (
          <View style={[styles.average, { bottom: scale(average) - 9 }]}>
            <View style={[styles.guideLine, { borderColor: colors.inkTertiary }]} />
            <View style={[styles.pill, { backgroundColor: colors.inkSecondary }]}>
              <Text variant="caption" weight="medium" tone="onInk">
                PROM
              </Text>
            </View>
          </View>
        )}
        <View style={styles.bars}>
          {bars.map((bar) => (
            <View key={bar.key} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(bar.value > 0 ? 3 : 0, scale(bar.value)),
                    backgroundColor: bar.highlight ? colors.inkSecondary : colors.ink,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.labels}>
        {bars.map((bar) => (
          <View key={bar.key} style={styles.labelColumn}>
            <Text variant="caption" tone="secondary" align="center">
              {bar.label}
            </Text>
            {bar.sublabel === undefined ? null : (
              <Text variant="caption" tone="tertiary" align="center">
                {bar.sublabel}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    rowGap: space.sm,
  },
  plot: {
    justifyContent: 'flex-end',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: space.sm,
    paddingRight: 40,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    maxWidth: 28,
    borderTopLeftRadius: radius.sm / 2,
    borderTopRightRadius: radius.sm / 2,
  },
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.sm,
  },
  guideLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  average: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  labels: {
    flexDirection: 'row',
    columnGap: space.sm,
    paddingRight: 40,
  },
  labelColumn: {
    flex: 1,
  },
});
