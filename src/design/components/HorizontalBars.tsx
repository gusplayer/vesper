import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Text } from './Text';

type HorizontalBarsProps = {
  rows: ReadonlyArray<{ key: string; label: string; value: number; valueText: string }>;
};

/** Label, bar, value — one line per row. 'Tu ritmo semanal'. */
export function HorizontalBars({ rows }: HorizontalBarsProps) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text variant="caption" tone="secondary" style={styles.label}>
            {row.label}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                { width: `${(row.value / max) * 100}%`, backgroundColor: colors.inkSecondary },
              ]}
            />
          </View>
          <Text variant="caption" tone="secondary" style={styles.value}>
            {row.valueText}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    rowGap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.md,
  },
  label: {
    width: 32,
  },
  track: {
    flex: 1,
    height: 12,
  },
  bar: {
    height: 12,
    borderRadius: radius.sm / 3,
    minWidth: 2,
  },
  value: {
    width: 52,
    textAlign: 'right',
  },
});
