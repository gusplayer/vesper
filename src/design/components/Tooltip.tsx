import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, shadow, space } from '../tokens';
import { Text } from './Text';

type TooltipProps = {
  message: string;
};

/** A small speech bubble that explains why a control did nothing. */
export function Tooltip({ message }: TooltipProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.bubble, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <Text variant="label" align="center">
          {message}
        </Text>
      </View>
      <View style={[styles.tail, { borderTopColor: colors.card }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 280,
    ...shadow.card,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
