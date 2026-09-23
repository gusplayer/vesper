import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { AppTile } from './AppTile';
import { Text } from './Text';

type AppRowProps = {
  /** The app's tile, from the data layer: a real icon, or a letter on a color. */
  icon?: string | null;
  initial: string;
  color?: string | null;
  name: string;
  /** A second line under the name: the category. */
  description?: string;
  /** Text on the right: a duration, a count. */
  value?: string;
  /** A control on the right: a checkbox, a toggle. */
  right?: ReactNode;
  /**
   * A row that hangs from the row above it instead of standing beside it: today's
   * usage broken down by app, under 'Redes' (ADR-0029). The tile shrinks to the width
   * of a ListRow's icon column — so the name starts one indent in — and the name and
   * the value drop one step in the type scale. A ledger's sub-line, not a ranking.
   */
  subordinate?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * A ListRow led by an AppTile instead of a Feather icon: the app pickers, the usage
 * breakdown. Same rhythm as ListRow — the same minimum height — so both can share a
 * ListGroup.
 */
export function AppRow({
  icon = null,
  initial,
  color = null,
  name,
  description,
  value,
  right,
  subordinate = false,
  onPress,
  accessibilityLabel,
}: AppRowProps) {
  const content = (
    <View style={styles.row}>
      <AppTile icon={icon} initial={initial} color={color} size={subordinate ? 'sm' : 'md'} />
      <View style={styles.text}>
        <Text variant={subordinate ? 'label' : 'body'}>{name}</Text>
        {description === undefined ? null : (
          <Text variant="label" tone="secondary">
            {description}
          </Text>
        )}
      </View>
      {value === undefined ? null : (
        <Text variant={subordinate ? 'label' : 'body'} tone="secondary">
          {value}
        </Text>
      )}
      {right}
    </View>
  );

  if (onPress === undefined) {
    // A static row is one VoiceOver element when it is given a label: without
    // `accessible` the label is dropped and the children are read loose.
    return accessibilityLabel === undefined ? (
      content
    ) : (
      <View accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
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
    minHeight: layout.touchTarget + space.xs,
    paddingVertical: space.sm,
  },
  text: {
    flex: 1,
    rowGap: space.xxs,
  },
});
