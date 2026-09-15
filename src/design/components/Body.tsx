import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { color, font } from '../tokens';

type BodyProps = {
  children: ReactNode;
};

/**
 * Reading text in ink. It did not exist before ADR-0015 because the app never read
 * anything back to the user; the session close is the first time it does.
 */
export function Body({ children }: BodyProps) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.family.regular,
    fontSize: font.size.body,
    color: color.ink,
    letterSpacing: font.letterSpacing.normal,
  },
});
