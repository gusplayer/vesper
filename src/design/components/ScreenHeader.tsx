import { Pressable, StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Label } from './Label';
import { Rule } from './Rule';

type ScreenHeaderProps = {
  left: string;
  right?: string;
  /** Makes the right label tappable text — the app's second kind of control. */
  onPressRight?: () => void;
};

/** Row of labels with a thick rule underneath. */
export function ScreenHeader({ left, right, onPressRight }: ScreenHeaderProps) {
  const rightLabel = right === undefined ? null : <Label>{right}</Label>;

  return (
    <View>
      <View style={styles.row}>
        <Label>{left}</Label>
        {onPressRight === undefined ? (
          rightLabel
        ) : (
          <Pressable onPress={onPressRight} accessibilityRole="button" accessibilityLabel={right}>
            {rightLabel}
          </Pressable>
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
