import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';

type FieldGroupProps = {
  children: ReactNode;
};

/**
 * A field and the line that explains it, kept close. Screen spaces its children as
 * sections; inside a group the gap is tighter, so a caption reads as part of the
 * field above it and not as the next thing on the page.
 */
export function FieldGroup({ children }: FieldGroupProps) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    rowGap: space.xs,
  },
});
