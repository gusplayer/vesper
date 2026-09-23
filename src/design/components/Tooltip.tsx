import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, shadow, space } from '../tokens';
import { Text } from './Text';

type TooltipProps = {
  message: string;
};

/**
 * A small speech bubble that explains why a control did nothing. It appears without
 * anything else moving, so it announces itself: a live region on Android, an alert
 * with the message as its label on iOS, where VoiceOver reads the bubble as one piece.
 */
export function Tooltip({ message }: TooltipProps) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
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
    maxWidth: layout.tooltip.maxWidth,
    ...shadow.card,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: layout.tooltip.tail,
    borderRightWidth: layout.tooltip.tail,
    borderTopWidth: layout.tooltip.tail,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
