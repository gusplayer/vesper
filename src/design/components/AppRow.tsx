import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { AppIcon } from './AppIcon';
import { Text } from './Text';

type AppRowProps = {
  /** The app's tile, from the data layer. */
  initial: string;
  color: string;
  name: string;
  /** A second line under the name: the category. */
  description?: string;
  /** A control on the right: a checkbox, a toggle. */
  right?: ReactNode;
  onPress?: () => void;
};

/**
 * A ListRow led by an AppIcon instead of a Feather icon: the app pickers, the usage
 * list. Same rhythm as ListRow so both can share a ListGroup.
 */
export function AppRow({ initial, color, name, description, right, onPress }: AppRowProps) {
  const content = (
    <View style={styles.row}>
      <AppIcon initial={initial} color={color} size="md" />
      <View style={styles.text}>
        <Text variant="body">{name}</Text>
        {description === undefined ? null : (
          <Text variant="label" tone="secondary">
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );

  if (onPress === undefined) {
    return content;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.md,
    minHeight: layout.touchTarget + space.sm,
    paddingVertical: space.sm,
  },
  text: {
    flex: 1,
    rowGap: 2,
  },
});
