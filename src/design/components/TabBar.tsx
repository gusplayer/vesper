import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

/**
 * Text-only tabs with a dot under the active one, like Brick. No icons: the words
 * are short and the dot is enough.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}
    >
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
            <Text variant="label" weight={active ? 'medium' : 'regular'} tone={active ? 'primary' : 'secondary'}>
              {label}
            </Text>
            <View
              style={[styles.dot, { backgroundColor: active ? colors.ink : 'transparent' }]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: space.md,
    paddingHorizontal: space.lg,
  },
  tab: {
    minHeight: layout.touchTarget,
    alignItems: 'center',
    rowGap: space.xs,
    paddingHorizontal: space.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
});
