import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md';

type AvatarProps = {
  /** The person's name; the initials are drawn from it. */
  name: string;
  size?: AvatarSize;
  /** The user's own avatar is ink on paper, so their row reads at a glance. */
  me?: boolean;
  accessibilityLabel?: string;
};

/** Row avatars sit between the small app tile and the touch target. */
const SIDE: Record<AvatarSize, number> = {
  sm: layout.appIcon.sm + space.sm,
  md: layout.appIcon.md,
};

/** 'Ana' → 'A', 'Ana María' → 'AM'. At most two letters; a blank name draws nothing. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * A round muted circle with a person's initials: the circle has no photos and no
 * server to fetch them from, and a letter is enough to tell four people apart.
 */
export function Avatar({ name, size = 'md', me = false, accessibilityLabel }: AvatarProps) {
  const { colors } = useTheme();
  const side = SIDE[size];
  return (
    <View
      style={[
        styles.circle,
        { width: side, height: side, backgroundColor: me ? colors.ink : colors.cardMuted },
      ]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Text variant={size === 'md' ? 'label' : 'caption'} weight="semibold" tone={me ? 'onInk' : 'primary'}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
