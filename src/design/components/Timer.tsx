import { StyleSheet, Text } from 'react-native';

import { color, font } from '../tokens';

type TimerProps = {
  /** Already formatted, e.g. '24:13'. Formatting is not a design decision. */
  value: string;
};

/** The session clock. Same serif as everything else — a mono would break coherence. */
export function Timer({ value }: TimerProps) {
  return <Text style={styles.text}>{value}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.family.regular,
    fontSize: font.size.timer,
    letterSpacing: font.letterSpacing.timer,
    color: color.ink,
    textAlign: 'center',
  },
});
