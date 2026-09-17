import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { space } from '../tokens';
import { Card } from './Card';
import { Text } from './Text';

type ListGroupProps = {
  children: ReactNode;
  /** Small caption above the card, in sentence case: 'General', 'Sistema'. */
  title?: string;
};

/** A card of rows with hairlines between them. */
export function ListGroup({ children, title }: ListGroupProps) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);

  return (
    <View style={styles.group}>
      {title === undefined ? null : (
        <Text variant="caption" tone="secondary" style={styles.title}>
          {title}
        </Text>
      )}
      <Card padded={false} style={styles.card}>
        {rows.map((row, index) => (
          <View key={index}>
            {index === 0 ? null : (
              <View style={[styles.line, { backgroundColor: colors.line }]} />
            )}
            {row}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    rowGap: space.sm,
  },
  title: {
    paddingHorizontal: space.xs,
  },
  card: {
    paddingHorizontal: space.lg,
  },
  line: {
    height: StyleSheet.hairlineWidth,
  },
});
