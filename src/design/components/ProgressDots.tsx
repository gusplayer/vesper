import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { radius, space } from '../tokens';

type ProgressDotsProps = {
  count: number;
  index: number;
};

/** Onboarding pager dots: the current one is a short bar. */
export function ProgressDots({ count, index }: ProgressDotsProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index ? styles.active : null,
            { backgroundColor: i === index ? colors.ink : colors.inkTertiary },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: space.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  active: {
    width: 18,
  },
});
