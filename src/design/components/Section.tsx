import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { SectionTitle } from './SectionTitle';

type SectionProps = {
  title?: string;
  /** Text on the right of the title, e.g. '3 / 50' or a small action. */
  right?: ReactNode;
  children: ReactNode;
};

/** A titled block of a page with consistent inner spacing. */
export function Section({ title, right, children }: SectionProps) {
  return (
    <View style={styles.section}>
      {title === undefined && right === undefined ? null : (
        <View style={styles.header}>
          {title === undefined ? <View /> : <SectionTitle>{title}</SectionTitle>}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    rowGap: space.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
