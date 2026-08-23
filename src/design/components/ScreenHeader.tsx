import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Label } from './Label';
import { Rule } from './Rule';

type ScreenHeaderProps = {
  left: string;
  right?: string;
};

/** Row of labels with a thick rule underneath. */
export function ScreenHeader({ left, right }: ScreenHeaderProps) {
  return (
    <View>
      <View style={styles.row}>
        <Label>{left}</Label>
        {right === undefined ? null : <Label>{right}</Label>}
      </View>
      <Rule weight="thick" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
});
