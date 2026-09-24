import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { useActivities, useSettings } from '../../data';
import type { Activity } from '../../data/types';
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
import { DEFAULT_HABIT_TARGET, HABIT_TARGET_OPTIONS } from '../../domain/habits';
import type { CountMode, Habit, HealthType } from '../../domain/types';
import { useLocale, useStrings } from '../../i18n';
import { status as healthStatus } from '../../platform/health';
import { stepGoalText } from '../health/format';
import { verifiedOption } from './verifiedOption';

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
function activityIdFor(name: string, activities: readonly Activity[]): string | null {
  const key = name.toLowerCase();
  return activities.find((activity) => activity.id === key || activity.label === key)?.id ?? null;
}

/**
 * The whole habit screen, shared by new and edit: name, times per week, how it is
 * counted, and the pinned save button. Verified counting only unlocks when Health
 * can confirm the name; when nothing can, the option falls to declared and the line
 * under the cards says so (verifiedOption.ts, ADR-0041). A habit already saved in
 * that state is corrected by opening this screen and saving.
 */
export function HabitForm({ title, initial, onSubmit, caption, secondary }: HabitFormProps) {
  const t = useStrings();
  const router = useRouter();
  const activities = useActivities();
  const settings = useSettings();
  const [name, setName] = useState(initial?.name ?? '');
  const [weeklyTarget, setWeeklyTarget] = useState(initial?.weeklyTarget ?? DEFAULT_HABIT_TARGET);
  const [countMode, setCountMode] = useState<CountMode>(initial?.countMode ?? 'declared');

  const trimmed = name.trim();
  const health = healthStatus();
  // Derived on every keystroke: renaming a habit can take verified away, and the
  // choice is kept so renaming back brings it straight back.
  const verified = verifiedOption(
    name,
    countMode,
    { ...health, connected: settings.healthConnected },
    t.habits.form,
  );

  // Only a verified steps habit counts against a number; a declared one is a tap.
  const { tag } = useLocale();
  const goal = verified.countMode === 'verified' ? stepGoalText(trimmed, t.habits.form, tag) : null;

  const save = () => {
    onSubmit({
      name: trimmed,
      weeklyTarget,
      countMode: verified.countMode,
      healthType: verified.healthType,
      activityId: activityIdFor(trimmed, activities),
    });
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.common.save} onPress={save} disabled={trimmed === ''} />
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
        label={t.habits.form.name}
        value={name}
        onChangeText={setName}
        placeholder={t.habits.form.namePlaceholder}
        autoFocus={initial === undefined}
      />
      <Section title={t.habits.form.timesPerWeek}>
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
      <Section title={t.habits.form.howCounted}>
        <CountModeCard
          title={t.habits.form.declared}
          description={t.habits.form.declaredDescription}
          selected={verified.countMode === 'declared'}
          onPress={() => setCountMode('declared')}
        />
        <CountModeCard
          title={t.habits.form.verified}
          description={verified.description}
          selected={verified.countMode === 'verified'}
          muted={!verified.verifiable}
          onPress={verified.verifiable ? () => setCountMode('verified') : undefined}
        />
        <Text variant="caption" tone="secondary">
          {verified.note}
        </Text>
        {goal === null ? null : (
          <Text variant="caption" tone="tertiary">
            {goal}
          </Text>
        )}
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
