import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, opacity, radius, space } from '../tokens';
import { Text } from './Text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** primary is the ink pill; secondary is a card pill; ghost is text only. */
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  /** Replaces the label while something is happening: 'Iniciando…'. */
  busyLabel?: string;
  busy?: boolean;
};

/**
 * The pill button. One primary per screen, pinned to the bottom, like Brick.
 * Pressed state dims instantly; no spring.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busyLabel,
  busy = false,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || busy;

  // Secondary sits on cards as often as on the page, so it is one step darker than
  // a card. Disabled reads the same way in every variant: secondary text, and the
  // whole pill faded, so a ghost (text only) is visibly off too. Busy keeps full
  // opacity: its label already says something is happening.
  const background =
    variant === 'primary'
      ? inactive
        ? colors.cardMuted
        : colors.ink
      : variant === 'secondary'
        ? colors.cardMuted
        : 'transparent';
  const tone = inactive ? 'secondary' : variant === 'primary' ? 'onInk' : 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: background,
          opacity: disabled && !busy ? opacity.disabled : pressed && !inactive ? 0.85 : 1,
        },
        variant === 'ghost' ? styles.ghost : null,
      ]}
    >
      <View>
        <Text variant="body" weight="medium" tone={tone} align="center">
          {busy && busyLabel !== undefined ? busyLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: layout.touchTarget + space.md,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    minHeight: layout.touchTarget,
  },
});
