import { Pressable, StyleSheet, Text } from 'react-native';

import { color, font, radius, rule, space } from '../tokens';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Selectable option. Selection is a 1px ink border and ink text; unselected is a
 * 0.5px ink30 border and ink60 text. No filled backgrounds anywhere.
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.box,
  },
  selected: {
    borderWidth: rule.thick,
    borderColor: color.ink,
  },
  unselected: {
    borderWidth: rule.thin,
    borderColor: color.ink30,
  },
  label: {
    fontFamily: font.family.regular,
    fontSize: font.size.body,
  },
  labelSelected: {
    color: color.ink,
  },
  labelUnselected: {
    color: color.ink60,
  },
});
