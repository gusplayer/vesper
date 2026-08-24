import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Label } from './Label';
import { Rule } from './Rule';
import { TextAction } from './TextAction';

type ScreenHeaderProps = {
  left: string;
  right?: string;
  /** Makes the right label tappable text — the app's second kind of control. */
  onPressRight?: () => void;
};

/** Row of labels with a thick rule underneath. */
export function ScreenHeader({ left, right, onPressRight }: ScreenHeaderProps) {
  return (
    <View>
      <View style={styles.row}>
        <Label>{left}</Label>
        {right === undefined ? null : onPressRight === undefined ? (
          <Label>{right}</Label>
        ) : (
          <TextAction label={right} onPress={onPressRight} />
        )}
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
