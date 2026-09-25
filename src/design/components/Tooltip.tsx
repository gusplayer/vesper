import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, shadow, space } from '../tokens';
import { Text } from './Text';

type TooltipProps = {
  message: string;
  /**
   * Float over what is under it instead of taking a row of the layout, so the list
   * below does not jump when it appears. The parent is the anchor: the bubble hangs
   * from its top edge, centred.
   */
  overlay?: boolean;
};

/**
 * A small speech bubble that explains why a control did nothing. It is a live region
 * on Android; iOS has none, so show it through `useTooltip`, which announces the
 * message and takes it down again.
 */
export function Tooltip({ message, overlay = false }: TooltipProps) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents={overlay ? 'none' : undefined}
      style={[styles.wrap, overlay ? styles.overlay : null]}
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    elevation: 4,
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
