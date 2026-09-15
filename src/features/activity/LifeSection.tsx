import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { USAGE, useLife } from '../../data';
import { Card, DotGrid, Section, Stack, Text } from '../../design/components';
import { projectedWeeksConsumed } from '../../domain/life';
import { daysText, weeksText } from './text';

/** 52 weeks a row: a year per line, like the classic life calendar. */
const LIFE_COLUMNS = 52;

type Unit = 'weeks' | 'days';

type LifeSectionProps = {
  now: number;
};

/**
 * Weeks left, a grid of the ones lived, and what the current social pace would take
 * from the rest. Framing, not a countdown (docs/PRD.md). Tapping the number switches
 * between weeks and days: the same time, at a scale that lands differently.
 */
export function LifeSection({ now }: LifeSectionProps) {
  const router = useRouter();
  const life = useLife(now);
  const [unit, setUnit] = useState<Unit>('weeks');
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

  const consumedWeeks = Math.round(projectedWeeksConsumed(USAGE.weekMs, life.left));
  const leftText = unit === 'weeks' ? weeksText(life.left) : daysText(life.left * 7);
  const consumedText = unit === 'weeks' ? weeksText(consumedWeeks) : daysText(consumedWeeks * 7);

  return (
    <Section title="Vida">
      <Card>
        <Stack gap="md">
          <Pressable
            onPress={() => setUnit(unit === 'weeks' ? 'days' : 'weeks')}
            accessibilityRole="button"
            accessibilityLabel={`Te quedan ${leftText}. Tocá para ver en ${unit === 'weeks' ? 'días' : 'semanas'}`}
          >
            <Stack gap="xs">
              <Text variant="title">{`Te quedan ${leftText}.`}</Text>
              <Text variant="body" tone="secondary">
                Hacé que valgan la pena.
              </Text>
              <Text variant="caption" tone="tertiary">
                {unit === 'weeks' ? 'Tocá el número para verlo en días.' : 'Tocá el número para verlo en semanas.'}
              </Text>
            </Stack>
          </Pressable>
          <DotGrid cells={cells} columns={LIFE_COLUMNS} gap={1} fill />
          <Stack gap="xs">
            <Text variant="label" tone="secondary">
              {`A tu ritmo actual, ${consumedText} de eso se irían en redes.`}
            </Text>
            <Text variant="caption" tone="tertiary">
              Estimación con datos de ejemplo. El dato real llega con Tiempo de uso.
            </Text>
          </Stack>
        </Stack>
      </Card>
    </Section>
  );
}
