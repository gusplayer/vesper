import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { USAGE, useLife } from '../../data';
import { Card, DotGrid, Section, Stack, StatCard, Text } from '../../design/components';
import { projectedWeeksConsumed } from '../../domain/life';
import { weeksText } from './text';

/** 52 weeks a row: a year per line, like the classic life calendar. */
const LIFE_COLUMNS = 52;
const LIFE_CELL = 4;
const LIFE_GAP = 1;

type LifeSectionProps = {
  now: number;
};

/**
 * Weeks left, a grid of the ones lived, and what the current social pace would take
 * from the rest. Framing, not a countdown (docs/PRD.md).
 */
export function LifeSection({ now }: LifeSectionProps) {
  const router = useRouter();
  const life = useLife(now);
  const cells = useMemo(
    () => (life === null ? [] : Array.from({ length: life.total }, (_, i) => i < life.lived)),
    [life],
  );

  if (life === null) {
    return (
      <Section title="Vida">
        <Card onPress={() => router.push('/settings/life')} accessibilityLabel="Ir a Ajustes, Vida">
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              Poné tu fecha de nacimiento en Ajustes › Vida
            </Text>
            <Text variant="label" tone="secondary">
              Sin eso no hay semanas que contar.
            </Text>
          </Stack>
        </Card>
      </Section>
    );
  }

  const consumed = Math.round(projectedWeeksConsumed(USAGE.weekMs, life.left));

  return (
    <Section title="Vida">
      <StatCard label="TE QUEDAN" value={weeksText(life.left)}>
        <DotGrid cells={cells} columns={LIFE_COLUMNS} size={LIFE_CELL} gap={LIFE_GAP} />
        <Text variant="caption" tone="secondary">
          {`A tu ritmo actual, ${consumed} de esas semanas en redes.`}
        </Text>
      </StatCard>
    </Section>
  );
}
