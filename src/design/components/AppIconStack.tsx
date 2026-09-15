import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { AppIcon } from './AppIcon';
import { Text } from './Text';

type AppIconStackProps = {
  apps: ReadonlyArray<{ id: string; initial: string; color: string }>;
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
        <AppIcon key={app.id} initial={app.initial} color={app.color} size="sm" />
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
