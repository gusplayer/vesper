import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, opacity, radius, space } from '../tokens';
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
  bars: readonly Bar[];
  /** What VoiceOver reads for the whole chart, e.g. per-day values. */
  accessibilityLabel?: string;
  /** Two dotted guide lines with a label on the right: [{ value, label }]. */
  guides?: readonly { value: number; label: string }[];
  /** The average pill on the right at this value. */
  average?: number;
  /** What the average pill says: 'PROM', 'AVG'. */
  averageLabel?: string;
};

/**
 * Vertical bars drawn with Views, no chart library. Scale is the max of bars, guides
 * and the average, so nothing ever overflows. Bars are ink; a highlighted one is
 * secondary ink.
 */
export function BarChart({ bars, guides = [], average, averageLabel, accessibilityLabel }: BarChartProps) {
  const { colors } = useTheme();
  const max = Math.max(
    1,
    ...bars.map((bar) => bar.value),
    ...guides.map((guide) => guide.value),
    average ?? 0,
  );
  const scale = (value: number) => (value / max) * HEIGHT;
  // A guide's label under the average pill would be half hidden ('2h' behind 'PROM'):
  // the line stays, the words go.
  const underPill = (value: number) =>
    average !== undefined && averageLabel !== undefined && Math.abs(scale(value) - scale(average)) < layout.chart.pillClearance;

  return (
    <View
      style={styles.chart}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel === undefined ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.plot, { height: HEIGHT + TOP_ROOM }]}>
        {guides.map((guide) => (
          <View key={guide.label} style={[styles.guide, { bottom: scale(guide.value) }]}>
            <View style={[styles.guideLine, { borderColor: colors.inkTertiary }]} />
            <View style={styles.gutter}>
              {underPill(guide.value) ? null : (
                <Text variant="caption" tone="secondary">
                  {guide.label}
                </Text>
              )}
            </View>
          </View>
        ))}
        {average === undefined ? null : (
          <View style={[styles.average, { bottom: Math.max(0, scale(average) - layout.chart.pillHalf) }]}>
            <View style={[styles.guideLine, { borderColor: colors.inkSecondary }]} />
            <View style={styles.gutter}>
              {averageLabel === undefined ? null : (
                <View style={[styles.pill, { backgroundColor: colors.ink }]}>
                  <Text variant="caption" weight="medium" tone="onInk">
                    {averageLabel}
                  </Text>
                </View>
              )}
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
                    height: Math.max(bar.value > 0 ? layout.chart.minBar : 0, scale(bar.value)),
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
            {/* A month gives each column a few points: the label keeps its own width,
                centred on the bar, and overflows the column instead of wrapping. */}
            <View style={styles.label}>
              <Text variant="caption" tone="secondary" align="center" numberOfLines={1}>
                {bar.label}
              </Text>
              {bar.sublabel === undefined ? null : (
                <Text variant="caption" tone="secondary" align="center" numberOfLines={1}>
                  {bar.sublabel}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The plot's height; the tallest of bars, guides and average reaches it. */
const HEIGHT = layout.chart.height;
/** Room above the tallest bar so the top guide label is not clipped. */
const TOP_ROOM = layout.chart.topRoom;
/** The right column shared by bars, labels, guide text and the average pill. */
const GUTTER = layout.chart.gutter;
/** Room for a label like 'mié' or '30', whatever the column under it measures. */
const LABEL_WIDTH = layout.chart.labelWidth;

const styles = StyleSheet.create({
  chart: {
    rowGap: space.sm,
  },
  gutter: {
    width: GUTTER,
    alignItems: 'flex-end',
  },
  plot: {
    justifyContent: 'flex-end',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: space.sm,
    paddingRight: GUTTER,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    maxWidth: layout.bar.column,
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
    borderTopWidth: layout.chart.guide,
    borderStyle: 'dashed',
    opacity: opacity.guide,
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
    paddingVertical: space.xxs,
  },
  labels: {
    flexDirection: 'row',
    columnGap: space.sm,
    paddingRight: GUTTER,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    width: LABEL_WIDTH,
  },
});
