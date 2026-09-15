import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { ACTIVITIES } from '../../data';
import {
  Button,
  Card,
  Check,
  Chip,
  FieldRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  Text,
} from '../../design/components';
import { DEFAULT_HABIT_TARGET, HABIT_TARGET_OPTIONS, healthTypeFor } from '../../domain/habits';
import type { CountMode, Habit, HealthType } from '../../domain/types';

export type HabitFormValues = {
  name: string;
  weeklyTarget: number;
  countMode: CountMode;
  healthType: HealthType | null;
  activityId: string | null;
};

type HabitFormProps = {
  title: string;
  /** Prefills the fields when editing. */
  initial?: Habit;
  onSubmit: (values: HabitFormValues) => void;
  /** A line under the button: how many habits are left, what archiving means. */
  caption?: string;
  /** A ghost action under the button: 'Archivar hábito'. */
  secondary?: ReactNode;
};

/** Auto-link the habit to an activity when the name is one (ADR-0008). */
function activityIdFor(name: string): string | null {
  const key = name.toLowerCase();
  return ACTIVITIES.find((activity) => activity.id === key || activity.label === key)?.id ?? null;
}

/**
 * The whole habit screen, shared by new and edit: name, times per week, how it is
 * counted, and the pinned save button. Verified counting only unlocks when Health
 * can confirm the name (domain/habits.ts).
 */
export function HabitForm({ title, initial, onSubmit, caption, secondary }: HabitFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [weeklyTarget, setWeeklyTarget] = useState(initial?.weeklyTarget ?? DEFAULT_HABIT_TARGET);
  const [countMode, setCountMode] = useState<CountMode>(initial?.countMode ?? 'declared');

  const trimmed = name.trim();
  const healthType = healthTypeFor(trimmed);
  const verifiable = healthType !== null;
  // A renamed habit can stop being verifiable; then it is declared, whatever was chosen.
  const effectiveMode: CountMode = verifiable ? countMode : 'declared';

  const save = () => {
    onSubmit({
      name: trimmed,
      weeklyTarget,
      countMode: effectiveMode,
      healthType: effectiveMode === 'verified' ? healthType : null,
      activityId: activityIdFor(trimmed),
    });
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Guardar" onPress={save} disabled={trimmed === ''} />
          {secondary}
          {caption === undefined ? null : (
            <Text variant="caption" tone="tertiary" align="center">
              {caption}
            </Text>
          )}
        </>
      }
    >
      <PageHeader title={title} onBack={() => router.back()} />
      <FieldRow
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="gym, leer, dormir 7h"
        autoFocus={initial === undefined}
      />
      <Section title="Veces por semana">
        <Stack direction="row" gap="sm">
          {HABIT_TARGET_OPTIONS.map((times) => (
            <Chip
              key={times}
              label={String(times)}
              selected={weeklyTarget === times}
              onPress={() => setWeeklyTarget(times)}
            />
          ))}
        </Stack>
      </Section>
      <Section title="Cómo se cuenta">
        <CountModeCard
          title="Declarado"
          description="Lo marcas tú"
          selected={effectiveMode === 'declared'}
          onPress={() => setCountMode('declared')}
        />
        <CountModeCard
          title="Verificado"
          description={
            verifiable
              ? 'Salud lo confirma solo'
              : 'Solo para hábitos que Salud puede confirmar: entrenamiento, caminata, sueño'
          }
          selected={effectiveMode === 'verified'}
          muted={!verifiable}
          onPress={verifiable ? () => setCountMode('verified') : undefined}
        />
        <Text variant="caption" tone="tertiary">
          En el prototipo Salud no confirma nada de verdad.
        </Text>
      </Section>
    </Screen>
  );
}

type CountModeCardProps = {
  title: string;
  description: string;
  selected: boolean;
  muted?: boolean;
  onPress?: () => void;
};

function CountModeCard({ title, description, selected, muted = false, onPress }: CountModeCardProps) {
  return (
    <Card tone={muted ? 'muted' : 'default'} onPress={onPress} accessibilityLabel={title}>
      <Stack direction="row" gap="md" align="center">
        <Stack gap="xs" grow>
          <Text variant="body" weight="medium" tone={muted ? 'tertiary' : 'primary'}>
            {title}
          </Text>
          <Text variant="label" tone={muted ? 'tertiary' : 'secondary'}>
            {description}
          </Text>
        </Stack>
        <Check checked={selected} />
      </Stack>
    </Card>
  );
}
