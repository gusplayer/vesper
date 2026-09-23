import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type DropdownTitleProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/**
 * A centered page title with a chevron-down: tapping it opens a picker for what the
 * page shows ('Actividad semanal ⌄'). Sits where a PageHeader title would.
 */
export function DropdownTitle({ label, onPress, accessibilityLabel }: DropdownTitleProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityLabel}
        hitSlop={space.sm}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text variant="body" weight="medium">
          {label}
        </Text>
        <Icon name="chevron-down" size="sm" tone="secondary" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: space.xs,
    // The target is the button, not the row around it: a title with a chevron is still
    // a control, and it has to be as tall as one.
    minHeight: layout.touchTarget,
    paddingHorizontal: space.md,
  },
});
