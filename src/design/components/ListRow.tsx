import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ListRowProps = {
  label: string;
  /** A second line under the label. */
  description?: string;
  icon?: IconName;
  /** Text on the right: a count, 'On', a value. */
  value?: string;
  /** A control on the right: a toggle, a radio, a checkbox. Replaces the chevron. */
  right?: ReactNode;
  /** Shows a chevron and makes the row press. */
  onPress?: () => void;
  tone?: 'primary' | 'danger';
  accessibilityLabel?: string;
};

/**
 * One line of a list: optional icon, label, optional description, then a value, a
 * control or a chevron on the right. Rows stack inside a ListGroup.
 */
export function ListRow({
  label,
  description,
  icon,
  value,
  right,
  onPress,
  tone = 'primary',
  accessibilityLabel,
}: ListRowProps) {
  const content = (
    <View style={styles.row}>
      {icon === undefined ? null : (
        <View style={styles.icon}>
          <Icon name={icon} size="md" tone={tone === 'danger' ? 'danger' : 'primary'} />
        </View>
      )}
      <View style={styles.text}>
        <Text variant="body" tone={tone === 'danger' ? 'danger' : 'primary'}>
          {label}
        </Text>
        {description === undefined ? null : (
          <Text variant="label" tone="secondary">
            {description}
          </Text>
        )}
      </View>
      {value === undefined ? null : (
        <Text variant="body" tone="secondary">
          {value}
        </Text>
      )}
      {right}
      {onPress !== undefined && right === undefined ? (
        <Icon name="chevron-right" size="sm" tone="secondary" />
      ) : null}
    </View>
  );

  if (onPress === undefined) {
    return content;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
  icon: {
    width: layout.icon.lg,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    rowGap: 2,
  },
});
