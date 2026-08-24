import { Pressable, StyleSheet, Text } from 'react-native';

import { color, font, layout, radius, rule, space } from '../tokens';

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
      style={({ pressed }) => [
        styles.block,
        disabled ? styles.disabled : styles.enabled,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.label,
            disabled ? styles.labelDisabled : styles.labelEnabled,
            pressed && !disabled ? styles.labelPressed : null,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: space.lg,
    minHeight: layout.touchTarget,
    justifyContent: 'center',
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
    // ink30 carries rules and boxes, never text — DESIGN_SYSTEM.md accessibility.
    color: color.ink60,
  },
  /** Inverted while held — ADR-0011. Never while disabled: nothing to acknowledge. */
  pressed: {
    backgroundColor: color.ink,
  },
  labelPressed: {
    color: color.paper,
  },
});
