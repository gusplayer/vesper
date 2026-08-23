import { StyleSheet, View } from 'react-native';

import { color, rule } from '../tokens';

type ProgressRuleProps = {
  /** 0 to 1. Clamped, so a caller cannot overflow the bar. */
  progress: number;
};

/**
 * A 3px bar. One of the only two things in the app allowed to move continuously,
 * and it moves because it measures, not to decorate.
 */
export function ProgressRule({ progress }: ProgressRuleProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: rule.progress,
    backgroundColor: color.ink30,
  },
  fill: {
    height: rule.progress,
    backgroundColor: color.ink,
  },
});
