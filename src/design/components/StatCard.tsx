import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { font, space } from '../tokens';
import { Card } from './Card';
import { Text } from './Text';

type StatCardProps = {
  /** Small caption above: 'horas enfocado'. */
  label: string;
  /** The big number: '1 hora', '21 días'. */
  value: string;
  /** A sentence under it. */
  description?: string;
  /** 'ink' is the dark headline card of the lifetime view. */
  tone?: 'default' | 'ink';
  children?: ReactNode;
};

/** A card with a caption, a big figure and a sentence. */
export function StatCard({ label, value, description, tone = 'default', children }: StatCardProps) {
  const onInk = tone === 'ink';
  return (
    <Card tone={onInk ? 'ink' : 'default'} style={styles.card}>
      <Text variant="caption" tone={onInk ? 'onInkSecondary' : 'secondary'} style={styles.label}>
        {label}
      </Text>
      <Text variant="title" tone={onInk ? 'onInk' : 'primary'}>
        {value}
      </Text>
      {description === undefined ? null : (
        <Text variant="label" tone={onInk ? 'onInkSecondary' : 'secondary'}>
          {description}
        </Text>
      )}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    rowGap: space.sm,
  },
  label: {
    letterSpacing: font.tracking.caps,
  },
});
