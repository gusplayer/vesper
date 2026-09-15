import { StyleSheet, View } from 'react-native';

import { layout } from '../tokens';
import { Text } from './Text';

export type AppIconSize = 'sm' | 'md' | 'lg';

type AppIconProps = {
  /** First letter drawn on the tile. */
  initial: string;
  /** Brand-ish color of the fake app. Comes from the data layer, never from a screen. */
  color: string;
  size?: AppIconSize;
};

/**
 * A rounded tile standing in for an app icon. The prototype has no real app assets
 * (and iOS never gives us any — ADR-0004), so a colored square with a letter is what
 * every "app" looks like.
 */
export function AppIcon({ initial, color, size = 'md' }: AppIconProps) {
  const side = layout.appIcon[size];
  return (
    <View
      style={[
        styles.tile,
        { width: side, height: side, borderRadius: side * 0.24, backgroundColor: color },
      ]}
    >
      <Text
        variant={size === 'lg' ? 'heading' : size === 'md' ? 'body' : 'caption'}
        weight="semibold"
        tone="onInk"
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
