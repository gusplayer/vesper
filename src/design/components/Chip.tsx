import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** A small pill option. Selected is ink on paper; unselected is a muted card. */
export function Chip({ label, selected, onPress }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.ink : colors.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text variant="label" weight="medium" tone={selected ? 'onInk' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.touchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
});
