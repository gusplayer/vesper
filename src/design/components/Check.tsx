import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius } from '../tokens';
import { Icon } from './Icon';

type CheckProps = {
  checked: boolean;
  /** 'radio' is the round one for exclusive choices; 'box' for lists of apps. */
  shape?: 'radio' | 'box';
  /** The active-mode check is green; a selection check is ink. */
  tone?: 'ink' | 'success';
};

/** A checkbox or radio, drawn from tokens. Not interactive by itself: put it in a row. */
export function Check({ checked, shape = 'radio', tone = 'ink' }: CheckProps) {
  const { colors } = useTheme();
  const fill = tone === 'success' ? colors.success : colors.ink;
  return (
    <View
      style={[
        styles.base,
        shape === 'radio' ? styles.radio : styles.box,
        checked
          ? { backgroundColor: fill, borderColor: fill }
          : { backgroundColor: 'transparent', borderColor: colors.inkSecondary },
      ]}
    >
      {checked ? <Icon name="check" size="sm" tone="onInk" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.check.size,
    height: layout.check.size,
    borderWidth: layout.check.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    borderRadius: radius.pill,
  },
  box: {
    borderRadius: layout.check.radius,
  },
});
