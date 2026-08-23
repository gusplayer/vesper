import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { color, font } from '../tokens';

type LabelProps = {
  children: ReactNode;
};

/** Secondary text in ink60. Lowercase except proper nouns. */
export function Label({ children }: LabelProps) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.family.regular,
    fontSize: font.size.label,
    color: color.ink60,
    letterSpacing: font.letterSpacing.normal,
  },
});
