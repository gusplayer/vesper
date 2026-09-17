import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { Text } from './Text';

type PeriodStripProps = {
  /** In display order: ['SEMANA PASADA', 'ESTA SEMANA']. */
  options: readonly { key: string; label: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

/**
 * A row of small text options under a title, the selected one in ink and the rest
 * faint. Brick's 'LAST WEEK · THIS WEEK' strip on the activity page.
 */
export function PeriodStrip({ options, selectedKey, onSelect }: PeriodStripProps) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            hitSlop={8}
            style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text
              variant="caption"
              weight={selected ? 'medium' : 'regular'}
              tone={selected ? 'primary' : 'secondary'}
              align="center"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: space.xxl,
  },
  option: {
    minHeight: layout.touchTarget - space.md,
    justifyContent: 'center',
  },
});
