import { Pressable, StyleSheet, Text } from 'react-native';

import { color, font, radius, rule, space } from '../tokens';

type PrimaryActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** The single primary control of a screen. Everything else is tappable text. */
export function PrimaryAction({ label, onPress, disabled = false }: PrimaryActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.block, disabled ? styles.disabled : styles.enabled]}
    >
      <Text style={[styles.label, disabled ? styles.labelDisabled : styles.labelEnabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: space.lg,
    borderRadius: radius.box,
    alignItems: 'center',
  },
  enabled: {
    borderWidth: rule.thick,
    borderColor: color.ink,
  },
  disabled: {
    borderWidth: rule.thin,
    borderColor: color.ink30,
  },
  label: {
    fontFamily: font.family.medium,
    fontSize: font.size.title,
  },
  labelEnabled: {
    color: color.ink,
  },
  labelDisabled: {
    color: color.ink30,
  },
});
