import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, opacity, space } from '../tokens';
import { AppTile } from './AppTile';
import { Check } from './Check';
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
  accessibilityHint?: string;
  /**
   * A row of a picker: with `selection` the row draws its own box (or radio) on the
   * right and VoiceOver hears a checkbox, checked or not. `right` still wins if given.
   */
  selected?: boolean;
  selection?: 'checkbox' | 'radio';
  /** Dims the row and ignores presses. */
  disabled?: boolean;
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
  accessibilityHint,
  selected,
  selection,
  disabled = false,
}: AppRowProps) {
  const trailing =
    right !== undefined ? (
      right
    ) : selection === undefined ? null : (
      <Check checked={selected === true} shape={selection === 'radio' ? 'radio' : 'box'} />
    );
  const content = (
    <View style={[styles.row, disabled ? styles.disabled : null]}>
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
      {trailing}
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
      disabled={disabled}
      accessibilityRole={selection === 'radio' ? 'radio' : selection === 'checkbox' ? 'checkbox' : 'button'}
      accessibilityLabel={accessibilityLabel ?? [name, description].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        selection !== undefined
          ? { checked: selected === true, disabled }
          : selected === undefined
            ? { disabled }
            : { selected, disabled }
      }
      style={({ pressed }) => ({ opacity: pressed && !disabled ? opacity.pressed : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: opacity.disabled,
  },
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
