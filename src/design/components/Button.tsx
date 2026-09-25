import { Pressable, StyleSheet, View } from 'react-native';

import { offFill, useSurface } from '../surface';
import { useTheme } from '../theme';
import { layout, opacity, radius, space } from '../tokens';
import { Text } from './Text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** primary is the ink pill; secondary is a card pill; ghost is text only. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /**
   * 'danger' writes the label in the danger color: for a ghost or secondary that
   * deletes, leaves or archives. A primary stays ink (a destructive primary is a
   * question for the screen, not a color).
   */
  tone?: 'default' | 'danger';
  /**
   * 'md' is the full pill of a footer. 'sm' is the small action pill that sits in a
   * row or a card ('Aceptar', 'Dar ánimo'): 44 pt tall, as wide as its label.
   */
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** Replaces the label while something is happening: 'Iniciando…'. */
  busyLabel?: string;
  busy?: boolean;
  /** What VoiceOver says when the label alone is not enough ('Dar ánimo a Ana'). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * The pill button. One primary per screen, pinned to the bottom, like Brick.
 * Pressed state dims instantly; no spring.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'default',
  size = 'md',
  disabled = false,
  busyLabel,
  busy = false,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const surface = useSurface();
  const inactive = disabled || busy;
  const small = size === 'sm';
  const shown = busy && busyLabel !== undefined ? busyLabel : label;

  // Secondary sits on cards as often as on the page, so it is one step away from what
  // it sits on (cardMuted on a card, card on the page). Disabled reads the same way in
  // every variant: secondary text, and the whole pill faded, so a ghost (text only) is
  // visibly off too. Busy keeps full opacity: its label already says something is
  // happening.
  const background =
    variant === 'primary'
      ? inactive
        ? colors.cardMuted
        : colors.ink
      : variant === 'secondary'
        ? small
          ? offFill(colors, surface)
          : colors.cardMuted
        : 'transparent';
  const textTone = inactive
    ? 'secondary'
    : variant === 'primary'
      ? 'onInk'
      : tone === 'danger'
        ? 'danger'
        : 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      // While busy VoiceOver reads what the pill shows, not the idle label.
      accessibilityLabel={busy && busyLabel !== undefined ? busyLabel : (accessibilityLabel ?? label)}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        small ? styles.small : styles.pill,
        {
          backgroundColor: background,
          opacity: disabled && !busy ? opacity.disabled : pressed && !inactive ? 0.85 : 1,
        },
        variant === 'ghost' && !small ? styles.ghost : null,
      ]}
    >
      <View>
        <Text variant={small ? 'label' : 'body'} weight="medium" tone={textTone} align="center">
          {shown}
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
  small: {
    minHeight: layout.touchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
