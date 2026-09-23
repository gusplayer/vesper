import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { AppTile } from './AppTile';
import { Text } from './Text';

type AppIconStackProps = {
  apps: readonly { id: string; initial: string; color?: string | null; icon?: string | null }[];
  /** How many tiles to draw before collapsing into '+N'. */
  max?: number;
};

/** A few small app tiles in a row, then '+N'. Used on mode cards. */
export function AppIconStack({ apps, max = 3 }: AppIconStackProps) {
  const shown = apps.slice(0, max);
  const rest = apps.length - shown.length;
  return (
    <View style={styles.row}>
      {shown.map((app) => (
        <AppTile key={app.id} icon={app.icon} initial={app.initial} color={app.color} size="sm" />
      ))}
      {rest > 0 ? (
        <Text variant="label" tone="secondary">
          {`+${rest}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.xs,
  },
});
