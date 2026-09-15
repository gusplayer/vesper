import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAppStore, useHabitsWeek, useSettings } from '../../data';
import { Chip, ListGroup, ListRow, Section, Sheet, Text, Tooltip } from '../../design/components';
import type { HabitProgress } from '../../domain/habits';
import { MAX_HABITS } from '../../domain/types';
import { habitProgressText } from '../../lib/format';
import { syncedText } from '../health/format';

type HabitsSectionProps = {
  now: number;
};

const TOOLTIP_MS = 2500;
const HEALTH_TIP = 'Este hábito lo marca Salud';

/**
 * This week's habits: a tap marks today, 'Editar hábitos' opens a sheet that leads to
 * the edit screen. Counts, never time (domain/habits.ts). While Health is connected a
 * verified habit is Health's to mark: a tap only says so (ADR-0005).
 */
export function HabitsSection({ now }: HabitsSectionProps) {
  const router = useRouter();
  const habits = useHabitsWeek(now);
  const settings = useSettings();
  const toggleHabitToday = useAppStore((state) => state.toggleHabitToday);
  const [editing, setEditing] = useState(false);
  const [tipVisible, setTipVisible] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const full = habits.length >= MAX_HABITS;

  useEffect(
    () => () => {
      if (tipTimer.current !== null) {
        clearTimeout(tipTimer.current);
      }
    },
    [],
  );

  const verifiedText = settings.healthConnected
    ? `verificado por Salud · ${syncedText(settings.healthSyncedAt)}`
    : 'verificado por Salud';

  const lockedByHealth = (progress: HabitProgress) =>
    settings.healthConnected && progress.habit.countMode === 'verified';

  const press = (progress: HabitProgress) => {
    if (!lockedByHealth(progress)) {
      toggleHabitToday(progress.habit.id, Date.now());
      return;
    }
    setTipVisible(true);
    if (tipTimer.current !== null) {
      clearTimeout(tipTimer.current);
    }
    tipTimer.current = setTimeout(() => setTipVisible(false), TOOLTIP_MS);
  };

  const accessibilityLabelFor = (progress: HabitProgress) => {
    if (lockedByHealth(progress)) {
      return `${progress.habit.name}, lo marca Salud`;
    }
    return progress.markedToday
      ? `Desmarcar ${progress.habit.name} hoy`
      : `Marcar ${progress.habit.name} hoy`;
  };

  return (
    <Section title="Hábitos esta semana">
      {tipVisible ? <Tooltip message={HEALTH_TIP} /> : null}
      <ListGroup>
        {habits.map((progress) => (
          <ListRow
            key={progress.habit.id}
            label={progress.habit.name}
            description={progress.habit.countMode === 'verified' ? verifiedText : 'declarado'}
            value={habitProgressText(progress)}
            right={
              lockedByHealth(progress) ? (
                <Text variant="caption" tone={progress.markedToday ? 'primary' : 'tertiary'}>
                  {progress.markedToday ? 'hoy ✓' : 'hoy –'}
                </Text>
              ) : (
                <Chip
                  label={progress.markedToday ? 'hoy ✓' : 'hoy'}
                  selected={progress.markedToday}
                  onPress={() => press(progress)}
                />
              )
            }
            onPress={() => press(progress)}
            accessibilityLabel={accessibilityLabelFor(progress)}
          />
        ))}
        {habits.length === 0 ? null : (
          <ListRow label="Editar hábitos" onPress={() => setEditing(true)} />
        )}
        {full ? null : (
          <ListRow label="Agregar hábito" icon="plus" onPress={() => router.push('/habits/new')} />
        )}
      </ListGroup>
      <Text variant="caption" tone="tertiary">
        {settings.healthConnected
          ? '“hoy” marca el día de hoy. El número es cuántos días llevás esta semana. Los verificados los marca Salud sola.'
          : '“hoy” marca el día de hoy. El número es cuántos días llevás esta semana.'}
      </Text>
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
