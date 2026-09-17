import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Text } from './Text';

type AvatarProps = {
  /** The person's name; the initials are drawn from it. */
  name: string;
  /** The user's own avatar is ink on paper, so their row reads at a glance. */
  me?: boolean;
};

/** Row avatars are the size of the medium app tile, so both can lead a ListRow. */
const SIDE = layout.appIcon.md;

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
export function Avatar({ name, me = false }: AvatarProps) {
  const { colors } = useTheme();
  // Decorative: the row it leads carries the name for VoiceOver.
  return (
    <View
      style={[styles.circle, { backgroundColor: me ? colors.ink : colors.cardMuted }]}
      accessible={false}
      importantForAccessibility="no"
    >
      <Text variant="label" weight="semibold" tone={me ? 'onInk' : 'primary'}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIDE,
    height: SIDE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
