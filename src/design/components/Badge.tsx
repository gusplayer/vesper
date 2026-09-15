import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Text } from './Text';

type BadgeProps = {
  label: string;
};

/** A small muted pill holding a short caption: '5 restantes', 'nuevo'. */
export function Badge({ label }: BadgeProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: colors.cardMuted }]}>
      <Text variant="caption" weight="medium" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
});
