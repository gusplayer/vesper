import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { space } from '../tokens';
import { Card } from './Card';
import { SectionTitle } from './SectionTitle';
import { Text } from './Text';

type ListGroupProps = {
  children: ReactNode;
  /** The title above the card, in sentence case: 'General', 'Sistema'. Same style as Section's. */
  title?: string;
  /** A caption under the card that explains the group: the notification budget, what a reset loses. */
  footer?: string;
};

/** A card of rows with hairlines between them. */
export function ListGroup({ children, title, footer }: ListGroupProps) {
  const { colors } = useTheme();
  // Rows that render nothing (a conditional `null`) leave no hairline behind.
  const rows = Children.toArray(children);

  return (
    <View style={styles.group}>
      {title === undefined ? null : <SectionTitle>{title}</SectionTitle>}
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
      {footer === undefined ? null : (
        <Text variant="caption" tone="secondary">
          {footer}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    rowGap: space.sm,
  },
  card: {
    paddingHorizontal: space.lg,
  },
  line: {
    height: StyleSheet.hairlineWidth,
  },
});
