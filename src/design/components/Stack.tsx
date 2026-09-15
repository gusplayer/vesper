import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '../tokens';

type StackProps = {
  children: ReactNode;
  /** Vertical by default; 'row' lays children side by side. */
  direction?: 'column' | 'row';
  gap?: keyof typeof space;
  align?: 'stretch' | 'center' | 'flex-start' | 'flex-end';
  justify?: 'flex-start' | 'center' | 'space-between' | 'flex-end';
  /** Takes the remaining space, for pushing a footer down. */
  grow?: boolean;
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Spacing between siblings. Screens use this instead of writing margins: the gap is a
 * token, and layout stays in the design layer.
 */
export function Stack({
  children,
  direction = 'column',
  gap = 'md',
  align = 'stretch',
  justify = 'flex-start',
  grow = false,
  wrap = false,
  style,
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: space[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        grow ? styles.grow : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
});
