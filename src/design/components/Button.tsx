import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
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
  /** Fires after holding for `holdMs`. The label says so. */
  onLongPress?: () => void;
  accessibilityLabel?: string;
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
  onLongPress,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || busy;

  const background =
    variant === 'primary'
      ? inactive
        ? colors.cardMuted
        : colors.ink
      : variant === 'secondary'
        ? colors.card
        : 'transparent';
  const tone = variant === 'primary' ? (inactive ? 'tertiary' : 'onInk') : 'primary';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: background, opacity: pressed && !inactive ? 0.85 : 1 },
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
