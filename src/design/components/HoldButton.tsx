import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, motion, radius, space } from '../tokens';
import { Text } from './Text';

type HoldButtonProps = {
  label: string;
  /** Small line under the label, e.g. '25 min · toca para cambiar'. */
  hint?: string;
  /** Fires once the fill reaches the end. */
  onHold: () => void;
  /** A short tap, released before the fill completes. */
  onPress?: () => void;
  disabled?: boolean;
  holdMs?: number;
};

/**
 * The focus button: hold it and a lighter fill sweeps across the pill; when it
 * reaches the end, the session starts. Let go early and it empties at once. A quick
 * tap does something smaller (choose the duration). One control, two honest gestures.
 */
export function HoldButton({ label, hint, onHold, onPress, disabled = false, holdMs = motion.holdMs }: HoldButtonProps) {
  const { colors } = useTheme();
  const [fill] = useState(() => new Animated.Value(0));
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const completed = useRef(false);

  function start(): void {
    completed.current = false;
    fill.setValue(0);
    animation.current = Animated.timing(fill, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.current.start(({ finished }) => {
      if (finished) {
        completed.current = true;
        fill.setValue(0);
        onHold();
      }
    });
  }

  function release(): void {
    animation.current?.stop();
    fill.setValue(0);
  }

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={disabled ? undefined : start}
        onPressOut={disabled ? undefined : release}
        onPress={() => {
          if (!disabled && !completed.current) {
            onPress?.();
          }
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        style={[styles.pill, { backgroundColor: disabled ? colors.cardMuted : colors.ink }]}
      >
        <Animated.View style={[styles.fill, { width, backgroundColor: colors.onInk }]} />
        <Text variant="body" weight="medium" tone={disabled ? 'secondary' : 'onInk'} align="center">
          {label}
        </Text>
      </Pressable>
      {hint === undefined ? null : (
        <Text variant="caption" tone="secondary" align="center">
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    rowGap: space.sm,
  },
  pill: {
    minHeight: layout.touchTarget + space.md,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.22,
  },
});
