import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, motion, radius, space } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { Text } from './Text';

/**
 * Text-only tabs. Under the active one, a short ink bar as wide as its word. When the
 * tab changes the bar does not travel: the old one fades out and the new one fades
 * in, in the route fade's 160 ms, because only opacity moves in Vesper (CLAUDE.md
 * rule 6). With "Reducir movimiento" it simply switches.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // One opacity per tab, made once: the four tabs never change.
  const [opacities] = useState(() => state.routes.map((_, index) => new Animated.Value(index === state.index ? 1 : 0)));

  useEffect(() => {
    if (reduceMotion) {
      opacities.forEach((value, index) => value.setValue(index === state.index ? 1 : 0));
      return undefined;
    }
    const fades = opacities.map((value, index) =>
      Animated.timing(value, {
        toValue: index === state.index ? 1 : 0,
        duration: motion.fadeMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const animation = Animated.parallel(fades);
    animation.start();
    return () => animation.stop();
  }, [state.index, opacities, reduceMotion]);

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, space.sm) }]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const active = state.index === index;
          const label = descriptors[route.key]?.options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              {/* The label box holds the bar, so the bar is exactly as wide as the word. */}
              <View style={styles.labelBox}>
                <Text variant="label" weight={active ? 'medium' : 'regular'} tone={active ? 'primary' : 'secondary'}>
                  {label}
                </Text>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.indicator, { backgroundColor: colors.ink, opacity: opacities[index] ?? 0 }]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const INDICATOR = layout.tabIndicator;

const styles = StyleSheet.create({
  bar: {
    paddingTop: space.md,
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tab: {
    minHeight: layout.touchTarget,
    alignItems: 'center',
    // The word sits at the bottom of its touch area, so the bar hugs it.
    justifyContent: 'flex-end',
    paddingHorizontal: space.sm,
  },
  labelBox: {
    paddingBottom: space.xs + INDICATOR,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: INDICATOR,
    borderRadius: radius.pill,
  },
});
