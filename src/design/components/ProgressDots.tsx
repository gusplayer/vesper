import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';

type ProgressDotsProps = {
  count: number;
  index: number;
  /** What VoiceOver reads for the row, from the screen: 'Paso 2 de 3'. */
  accessibilityLabel?: string;
};

/** Onboarding pager dots: the current one is a short bar. A progress bar to VoiceOver. */
export function ProgressDots({ count, index, accessibilityLabel }: ProgressDotsProps) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 1, max: Math.max(1, count), now: Math.min(count, index + 1) }}
    >
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
    alignItems: 'center',
    columnGap: space.sm,
  },
  dot: {
    width: layout.dot.size,
    height: layout.dot.size,
    borderRadius: radius.pill,
  },
  active: {
    width: layout.dot.active,
  },
});
