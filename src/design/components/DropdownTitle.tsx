import { Pressable, StyleSheet, View } from 'react-native';

import { layout, opacity, space } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type DropdownTitleProps = {
  label: string;
  onPress: () => void;
  /** What a tap does, read after the label: 'Elegir qué actividad ver'. */
  accessibilityLabel?: string;
  /**
   * 'body' is a page title (Actividad). 'heading' is the mode name on Focus, 'label'
   * the duration row above the focus button.
   */
  size?: 'label' | 'body' | 'heading';
  /** 'secondary' for a quiet picker (the duration row). */
  tone?: 'primary' | 'secondary';
  /** Off during a session: the words stay, the chevron goes, taps do nothing. */
  disabled?: boolean;
};

/**
 * A centered title with a chevron-down: tapping it opens a picker for what the page
 * shows ('Actividad semanal ⌄'), which mode is active, how long the next session is.
 * The target is always at least 44 pt tall.
 */
export function DropdownTitle({
  label,
  onPress,
  accessibilityLabel,
  size = 'body',
  tone = 'primary',
  disabled = false,
}: DropdownTitleProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityLabel}
        accessibilityState={{ disabled }}
        hitSlop={space.sm}
        style={({ pressed }) => [styles.button, { opacity: pressed && !disabled ? opacity.pressed : 1 }]}
      >
        <Text variant={size} weight={size === 'label' ? 'regular' : 'medium'} tone={tone}>
          {label}
        </Text>
        {disabled ? null : <Icon name="chevron-down" size="sm" tone="secondary" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.xs,
    // The target is the button, not the row around it: a title with a chevron is still
    // a control, and it has to be as tall as one.
    minHeight: layout.touchTarget,
    paddingHorizontal: space.md,
  },
});
