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
        hitSlop={8}
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
    minHeight: layout.touchTarget,
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
  },
});
