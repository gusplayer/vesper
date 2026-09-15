import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, layout, rule } from '../tokens';

type TextActionProps = {
  label: string;
  onPress: () => void;
  /** 'label' for actions, 'caption' for hints. Both carry the rule. */
  size?: 'label' | 'caption';
  accessibilityLabel?: string;
};

/**
 * Tappable text: the app's second kind of control, and until ADR-0011 it looked exactly
 * like text that does nothing.
 *
 * The thin rule underneath is already this app's vocabulary for "you act here" — it is
 * what TextField is made of. Pressing darkens ink60 to ink, instantly.
 */
export function TextAction({ label, onPress, size = 'label', accessibilityLabel }: TextActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      // hitSlop rather than a minimum height: this often sits in a header row, and
      // growing the box there pushed the thick rule away from the title. The touch
      // area reaches the 44pt of ADR-0011 without the layout knowing.
      hitSlop={layout.textHitSlop}
    >
      {({ pressed }) => (
        <View>
          <Text
            style={[
              styles.text,
              size === 'caption' ? styles.caption : styles.label,
              pressed ? styles.pressed : null,
            ]}
          >
            {label}
          </Text>
          <View style={styles.rule} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.family.regular,
    color: color.ink60,
  },
  label: {
    fontSize: font.size.label,
  },
  caption: {
    fontSize: font.size.caption,
  },
  pressed: {
    color: color.ink,
  },
  rule: {
    height: rule.thin,
    backgroundColor: color.ink30,
  },
});
