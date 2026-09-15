import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, motion, radius, space } from '../tokens';
import { Text } from './Text';

type Slot = { x: number; width: number };

/**
 * Text-only tabs. Under the active one, a short ink bar that slides sideways when the
 * tab changes — the same movement as the flip clock's flaps: linear-ish, no bounce.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tabs, setTabs] = useState<Record<number, Slot>>({});
  const [labels, setLabels] = useState<Record<number, number>>({});
  const [x] = useState(() => new Animated.Value(0));
  const [width] = useState(() => new Animated.Value(0));
  const first = useRef(true);

  const tab = tabs[state.index];
  const labelWidth = labels[state.index];
  const target: Slot | undefined =
    tab === undefined || labelWidth === undefined
      ? undefined
      : { x: tab.x + (tab.width - labelWidth) / 2, width: labelWidth };
  useEffect(() => {
    if (target === undefined) {
      return;
    }
    if (first.current) {
      x.setValue(target.x);
      width.setValue(target.width);
      first.current = false;
      return;
    }
    Animated.parallel([
      Animated.timing(x, { toValue: target.x, duration: motion.slideMs, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(width, { toValue: target.width, duration: motion.slideMs, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start();
    // Only the numbers matter, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.x, target?.width, x, width]);

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
              onLayout={(event: LayoutChangeEvent) => {
                const { x: left, width: w } = event.nativeEvent.layout;
                setTabs((current) =>
                  current[index]?.x === left && current[index]?.width === w
                    ? current
                    : { ...current, [index]: { x: left, width: w } },
                );
              }}
            >
              <View
                onLayout={(event: LayoutChangeEvent) => {
                  const w = event.nativeEvent.layout.width;
                  setLabels((current) => (current[index] === w ? current : { ...current, [index]: w }));
                }}
                // The label box is what the bar measures, so the bar is as wide as the word.
                style={styles.labelBox}
              >
                <Text variant="label" weight={active ? 'medium' : 'regular'} tone={active ? 'primary' : 'secondary'}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: colors.ink, transform: [{ translateX: x }], width }]}
        />
      </View>
    </View>
  );
}

const INDICATOR = 3;

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
    height: INDICATOR,
    borderRadius: radius.pill,
  },
});
