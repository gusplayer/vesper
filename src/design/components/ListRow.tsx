import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, space } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ListRowProps = {
  label: string;
  /** A second line under the label. */
  description?: string;
  icon?: IconName;
  /** Something drawn instead of the icon: a real app image. */
  leading?: ReactNode;
  /** Text on the right: a count, 'On', a value. */
  value?: string;
  /** A control on the right: a toggle, a radio, a checkbox. Replaces the chevron. */
  right?: ReactNode;
  /** Makes the row press. A 'link' shows a chevron; an 'action' (alert, toggle) does not. */
  onPress?: () => void;
  kind?: 'link' | 'action';
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
  leading,
  value,
  right,
  onPress,
  kind = 'link',
  tone = 'primary',
  accessibilityLabel,
}: ListRowProps) {
  const { colors } = useTheme();
  // VoiceOver reads what is on screen: label, description and value, in that order.
  const spokenLabel = accessibilityLabel ?? [label, description, value].filter(Boolean).join(', ');
  const content = (
    <View style={styles.row}>
      {leading}
      {icon === undefined ? null : (
        <View style={styles.icon}>
          <Icon name={icon} size="row" tone={tone === 'danger' ? 'danger' : 'secondary'} />
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
      {onPress !== undefined && right === undefined && kind === 'link' ? (
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
      accessibilityLabel={spokenLabel}
      style={({ pressed }) => [styles.pressable, pressed ? { backgroundColor: colors.cardMuted } : null]}
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
  icon: {
    width: layout.icon.lg,
    alignItems: 'center',
  },
  pressable: {
    marginHorizontal: -space.lg,
    paddingHorizontal: space.lg,
  },
  text: {
    flex: 1,
    rowGap: 2,
  },
});
