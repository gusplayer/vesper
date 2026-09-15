import { StyleSheet, Text, View } from 'react-native';

import { color, font, radius, space } from '../tokens';

type TimerProps = {
  /** Already formatted, e.g. '24:13'. Formatting is not a design decision. */
  value: string;
};

/**
 * The session clock, in ink. A filled box with paper digits that stays that way for
 * the whole session: a PrimaryAction pressed and never released — ADR-0014. It is the
 * only filled box in the app outside WeekGrid, and it says the same thing the lived
 * weeks do: time that is already yours is in ink.
 *
 * Same serif as everything else — a mono would break coherence.
 */
export function Timer({ value }: TimerProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: color.ink,
    borderRadius: radius.box,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  text: {
    fontFamily: font.family.regular,
    fontSize: font.size.timer,
    letterSpacing: font.letterSpacing.timer,
    color: color.paper,
    textAlign: 'center',
  },
});
