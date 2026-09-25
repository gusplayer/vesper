import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
} from 'react-native';

import { useTheme } from '../theme';
import { layout, opacity, space } from '../tokens';
import { Check } from './Check';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ListRowProps = {
  label: string;
  /** A second line under the label. */
  description?: string;
  icon?: IconName;
  /** Something drawn instead of the icon: a real app image. */
  leading?: ReactNode;
  /** Text on the right: a count, 'On', a value. It shrinks and wraps before the label does. */
  value?: string;
  /** Clip the value to this many lines (a comma list of apps). Wraps freely by default. */
  valueLines?: number;
  /** A control on the right: a toggle, a radio, a checkbox. Replaces the chevron. */
  right?: ReactNode;
  /** Makes the row press. A 'link' shows a chevron; an 'action' (alert, toggle) does not. */
  onPress?: () => void;
  onLongPress?: () => void;
  kind?: 'link' | 'action';
  tone?: 'primary' | 'danger';
  /**
   * A row of a single or multiple choice. With `selection` the row draws its own
   * `Check` on the right (radio or box) and VoiceOver hears a radio or a checkbox,
   * checked or not. Without it, `selected` only sets the "selected" state.
   */
  selected?: boolean;
  selection?: 'radio' | 'checkbox';
  /** The check's color: 'success' only for the active mode. */
  checkTone?: 'ink' | 'success';
  /** An accordion row: draws a chevron up or down and says expanded or collapsed. */
  expanded?: boolean;
  /** Dims the row and ignores presses. */
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
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
  valueLines,
  right,
  onPress,
  onLongPress,
  kind = 'link',
  tone = 'primary',
  selected,
  selection,
  checkTone = 'ink',
  expanded,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityActions,
  onAccessibilityAction,
}: ListRowProps) {
  const { colors } = useTheme();
  // VoiceOver reads what is on screen: label, description and value, in that order.
  const spokenLabel = accessibilityLabel ?? [label, description, value].filter(Boolean).join(', ');
  const pressable = onPress !== undefined || onLongPress !== undefined;
  const trailing =
    right !== undefined ? (
      right
    ) : selection !== undefined ? (
      <Check checked={selected === true} shape={selection === 'radio' ? 'radio' : 'box'} tone={checkTone} />
    ) : expanded !== undefined ? (
      <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size="sm" tone="secondary" />
    ) : pressable && kind === 'link' ? (
      <Icon name="chevron-right" size="sm" tone="secondary" />
    ) : null;

  const content = (
    <View style={[styles.row, disabled ? styles.disabled : null]}>
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
        <View style={styles.value}>
          <Text variant="body" tone="secondary" align="right" numberOfLines={valueLines}>
            {value}
          </Text>
        </View>
      )}
      {trailing}
    </View>
  );

  const role = selection === 'radio' ? 'radio' : selection === 'checkbox' ? 'checkbox' : 'button';
  const state = {
    disabled,
    ...(selection !== undefined ? { checked: selected === true } : selected === undefined ? {} : { selected }),
    ...(expanded === undefined ? {} : { expanded }),
  };

  if (!pressable) {
    // A static row still says its state when it has one (a checked item in a summary).
    return selection === undefined && selected === undefined ? (
      content
    ) : (
      <View accessible accessibilityLabel={spokenLabel} accessibilityRole={selection === undefined ? undefined : role} accessibilityState={state}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={spokenLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={state}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={({ pressed }) => [styles.pressable, pressed && !disabled ? { backgroundColor: colors.cardMuted } : null]}
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
  disabled: {
    opacity: opacity.disabled,
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
    rowGap: space.xxs,
  },
  // The value gives way before the label: at most as wide as the label column, and
  // it wraps (or clips to `valueLines`) instead of squeezing the label to a sliver.
  value: {
    flexShrink: 1,
    maxWidth: '50%',
  },
});
