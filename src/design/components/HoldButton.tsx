import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { dissolveLayers } from '../../lib/dissolve';
import { useTheme } from '../theme';
import { layout, motion, radius, space } from '../tokens';
import { InkFlood } from './InkFlood';
import { Text } from './Text';

/** Paper dots over ink, capped so the label stays readable when the pill is full. */
const DOT_OPACITY = 0.55;

type HoldButtonProps = {
  label: string;
  /** Fires once the page is ink: the caller starts the session and opens its route. */
  onHold: () => void;
  /** A short tap, released before the fill completes. */
  onPress?: () => void;
  disabled?: boolean;
  holdMs?: number;
  accessibilityHint?: string;
};

/**
 * The focus button for a deep mode, the one session with no way out. Hold it and paper
 * dots close in from both ends of the pill toward the middle; let go early and they
 * vanish at once. When they meet, ink floods the page from the button and the session
 * opens underneath. A quick tap does something smaller, when the caller gives it one.
 */
export function HoldButton({
  label,
  onHold,
  onPress,
  disabled = false,
  holdMs = motion.holdMs,
  accessibilityHint,
}: HoldButtonProps) {
  const { colors } = useTheme();
  const [fill] = useState(() => new Animated.Value(0));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [flooding, setFlooding] = useState(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const completed = useRef(false);
  const pill = useRef<View>(null);

  const layers = useMemo(
    () =>
      dissolveLayers({
        width: size.width,
        height: size.height,
        spacing: motion.dissolve.buttonSpacing,
        layers: motion.dissolve.buttonLayers,
        direction: { kind: 'inward' },
      }),
    [size],
  );

  function measure(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  function start(): void {
    completed.current = false;
    fill.setValue(0);
    animation.current = Animated.timing(fill, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.current.start(({ finished }) => {
      if (!finished) {
        return;
      }
      completed.current = true;
      // The flood starts where the button is, so it reads as the button spilling over.
      pill.current?.measureInWindow((x, y, width, height) => {
        setOrigin({ x: x + width / 2, y: y + height / 2 });
        setFlooding(true);
      });
    });
  }

  function release(): void {
    if (completed.current) {
      return;
    }
    animation.current?.stop();
    fill.setValue(0);
  }

  function flooded(): void {
    onHold();
    // InkFlood lingers through the route fade on its own; the button resets now.
    setFlooding(false);
    fill.setValue(0);
    completed.current = false;
  }

  const count = layers.length;

  return (
    <View>
      <Pressable
        ref={pill}
        onLayout={measure}
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
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={[styles.pill, { backgroundColor: disabled ? colors.cardMuted : colors.ink }]}
      >
        {size.width === 0
          ? null
          : layers.map((layer, index) => (
              <Animated.View
                key={index}
                pointerEvents="none"
                style={[
                  styles.dots,
                  {
                    opacity: fill.interpolate({
                      inputRange: [index / count, (index + 1) / count],
                      outputRange: [0, DOT_OPACITY],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
                  <Path d={layer.path} fill={colors.onInk} />
                </Svg>
              </Animated.View>
            ))}
        <Text variant="body" weight="medium" tone={disabled ? 'secondary' : 'onInk'} align="center">
          {label}
        </Text>
      </Pressable>
      <InkFlood active={flooding} origin={origin} onDone={flooded} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: layout.touchTarget + space.md,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
