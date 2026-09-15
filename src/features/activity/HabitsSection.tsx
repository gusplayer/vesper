import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAppStore, useHabitsWeek } from '../../data';
import { Check, ListGroup, ListRow, Section, Sheet, Text } from '../../design/components';
import { MAX_HABITS } from '../../domain/types';
import { habitProgressText } from '../../lib/format';

type HabitsSectionProps = {
  now: number;
};

/**
 * This week's habits: a tap marks today, 'Editar hábitos' opens a sheet that leads to
 * the edit screen. Counts, never time (domain/habits.ts).
 */
export function HabitsSection({ now }: HabitsSectionProps) {
  const router = useRouter();
  const habits = useHabitsWeek(now);
  const toggleHabitToday = useAppStore((state) => state.toggleHabitToday);
  const [editing, setEditing] = useState(false);
  const full = habits.length >= MAX_HABITS;

  return (
    <Section title="Hábitos esta semana">
      <ListGroup>
        {habits.map((progress) => (
          <ListRow
            key={progress.habit.id}
            label={progress.habit.name}
            description={
              progress.habit.countMode === 'verified' ? 'verificado por Salud' : 'declarado'
            }
            value={habitProgressText(progress)}
            right={<Check shape="box" checked={progress.markedToday} />}
            onPress={() => toggleHabitToday(progress.habit.id, Date.now())}
            accessibilityLabel={
              progress.markedToday
                ? `Desmarcar ${progress.habit.name} hoy`
                : `Marcar ${progress.habit.name} hoy`
            }
          />
        ))}
        {habits.length === 0 ? null : (
          <ListRow label="Editar hábitos" onPress={() => setEditing(true)} />
        )}
        {full ? null : (
          <ListRow label="Agregar hábito" icon="plus" onPress={() => router.push('/habits/new')} />
        )}
      </ListGroup>
      {full ? (
        <Text variant="caption" tone="tertiary">
          Cinco es el máximo, a propósito.
        </Text>
      ) : null}
      <Sheet visible={editing} title="Editar hábitos" onClose={() => setEditing(false)}>
        <ListGroup>
          {habits.map((progress) => (
            <ListRow
              key={progress.habit.id}
              label={progress.habit.name}
              onPress={() => {
                setEditing(false);
                router.push({ pathname: '/habits/edit', params: { id: progress.habit.id } });
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </Section>
  );
}
