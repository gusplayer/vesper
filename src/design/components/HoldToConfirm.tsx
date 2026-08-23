import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { color, font, rule, space } from '../tokens';

type HoldToConfirmProps = {
  label: string;
  onConfirm: () => void;
  holdMs: number;
  /**
   * When false the control does not respond at all — no bar, no feedback. That is
   * what `deep` depth looks like: the only way out is the timer running out.
   */
  enabled?: boolean;
};

/**
 * Press and hold. The bar is one of the two things allowed to move continuously in
 * this app, and it moves linearly: no spring, no easing curve with personality.
 *
 * Releasing early resets instantly rather than animating back — an animated rewind
 * would be decoration.
 */
export function HoldToConfirm({ label, onConfirm, holdMs, enabled = true }: HoldToConfirmProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabledNow) => {
      if (active) {
        setScreenReader(enabledNow);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      animation.current?.stop();
    };
  }, []);

  function start(): void {
    if (!enabled) {
      return;
    }
    animation.current = Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.current.start(({ finished }) => {
      if (finished) {
        progress.setValue(0);
        onConfirm();
      }
    });
  }

  function cancel(): void {
    animation.current?.stop();
    progress.setValue(0);
  }

  // With a screen reader on, holding is not a gesture a user can perform reliably, so
  // the control becomes a plain button. DESIGN_SYSTEM.md requires this alternative.
  if (screenReader) {
    return (
      <Pressable
        onPress={enabled ? onConfirm : undefined}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.block}
      >
        <Text style={[styles.label, enabled ? styles.labelEnabled : styles.labelDisabled]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={styles.block}
    >
      <Text style={[styles.label, enabled ? styles.labelEnabled : styles.labelDisabled]}>
        {label}
      </Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    rowGap: space.sm,
  },
  label: {
    fontFamily: font.family.regular,
    fontSize: font.size.body,
    textAlign: 'center',
  },
  labelEnabled: {
    color: color.ink60,
  },
  labelDisabled: {
    color: color.ink30,
  },
  track: {
    height: rule.progress,
    backgroundColor: color.ink30,
  },
  fill: {
    height: rule.progress,
    backgroundColor: color.ink,
  },
});
