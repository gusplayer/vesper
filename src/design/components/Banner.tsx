import { Pressable, StyleSheet, View } from 'react-native';

import { useChrome } from '../chrome';
import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

/** The x is a 16 pt glyph; its touch area is 44. */
const DISMISS_SLOP = (layout.touchTarget - layout.icon.sm) / 2;

type BannerProps = {
  title: string;
  message: string;
  onDismiss: () => void;
};

/** The dark strip at the top of the home page: 'Cumpliste. Completaste tu primera rutina.' */
export function Banner({ title, message, onDismiss }: BannerProps) {
  const { colors } = useTheme();
  const { dismiss } = useChrome();
  return (
    <View style={[styles.banner, { backgroundColor: colors.ink }]}>
      <View style={styles.text}>
        <Text variant="body" weight="medium" tone="onInk">
          {title}
        </Text>
        <Text variant="label" tone="onInk">
          {message}
        </Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={DISMISS_SLOP} accessibilityRole="button" accessibilityLabel={dismiss}>
        <Icon name="x" size="sm" tone="onInk" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: space.lg,
    columnGap: space.md,
  },
  text: {
    flex: 1,
    rowGap: space.xxs,
  },
});
