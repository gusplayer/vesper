import { Pressable, StyleSheet, Text } from 'react-native';

import { color, font, layout, radius, rule, space } from '../tokens';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Selectable option. Selection is a 1px ink border and ink text; unselected is a
 * 0.5px ink30 border and ink60 text. The only fill is the pressed inversion, and it
 * is gone the moment the finger lifts — ADR-0011.
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed ? styles.pressed : null,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.label,
            selected ? styles.labelSelected : styles.labelUnselected,
            pressed ? styles.labelPressed : null,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    minHeight: layout.touchTarget,
    justifyContent: 'center',
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
  /** A Kindle inverts what you touch. Instant on press, instant on release — ADR-0011. */
  pressed: {
    backgroundColor: color.ink,
  },
  labelPressed: {
    color: color.paper,
  },
});
