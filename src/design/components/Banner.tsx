import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type BannerProps = {
  title: string;
  message: string;
  onDismiss: () => void;
};

/** The dark strip at the top of the home page: 'Cumpliste. Completaste tu primera rutina.' */
export function Banner({ title, message, onDismiss }: BannerProps) {
  const { colors } = useTheme();
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
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="cerrar aviso">
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
    rowGap: 2,
  },
});
