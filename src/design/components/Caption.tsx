import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { color, font } from '../tokens';

type CaptionProps = {
  children: ReactNode;
};

/** Hint text, the smallest type in the app. */
export function Caption({ children }: CaptionProps) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: font.family.regular,
    fontSize: font.size.caption,
    color: color.ink60,
    letterSpacing: font.letterSpacing.normal,
  },
});
