import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { useActivities, useSettings } from '../../data';
import type { Activity } from '../../data/types';
import {
  Button,
  ChipGroup,
  ChoiceCard,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  StatusNote,
} from '../../design/components';
import { DEFAULT_HABIT_TARGET, HABIT_TARGET_OPTIONS } from '../../domain/habits';
import type { CountMode, Habit, HealthType } from '../../domain/types';
import { useLocale, useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { status as healthStatus } from '../../platform/health';
import { stepGoalText } from '../health/format';
import { targetOptions } from './targetOptions';
import { useAskHealthForHabit } from './useAskHealthForHabit';
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
  /** Set when the habit is a challenge's: the target is locked to it and the row opens it. */
  challenge?: HabitChallenge;
};

/**
 * The challenge a habit belongs to (ADR-0031). Its target is the challenge's, so the
 * form shows it instead of offering chips that would make the two drift apart.
 */
export type HabitChallenge = {
  id: string;
  /** 'Reto con Ana y Luis', already in the user's language. */
  line: string;
  weeklyTarget: number;
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
 *
 * Saving a verified habit while Health exists but is not connected asks for it right
 * here (ADR-0005); a no still saves. The target chips always include the saved
 * target, so a 5 from the demo or from a challenge is shown and kept, not lost to the
 * first tap.
 */
export function HabitForm({ title, initial, onSubmit, caption, secondary, challenge }: HabitFormProps) {
  const t = useStrings();
  const router = useRouter();
  const activities = useActivities();
  const settings = useSettings();
  const [name, setName] = useState(initial?.name ?? '');
  const [weeklyTarget, setWeeklyTarget] = useState(initial?.weeklyTarget ?? DEFAULT_HABIT_TARGET);
  const [countMode, setCountMode] = useState<CountMode>(initial?.countMode ?? 'declared');
  const [asking, setAsking] = useState(false);
  const askHealth = useAskHealthForHabit();
  const options = targetOptions(HABIT_TARGET_OPTIONS, initial?.weeklyTarget);

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

  const save = async () => {
    const values: HabitFormValues = {
      name: trimmed,
      weeklyTarget: challenge?.weeklyTarget ?? weeklyTarget,
      countMode: verified.countMode,
      healthType: verified.healthType,
      activityId: activityIdFor(trimmed, activities),
    };
    if (askHealth.needsAsking(trimmed, verified.countMode)) {
      setAsking(true);
      await askHealth.ask(trimmed, verified.countMode);
      setAsking(false);
    }
    onSubmit(values);
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      footer={
        <>
          <Button
            label={t.common.save}
            onPress={() => void save()}
            disabled={trimmed === ''}
            busy={asking}
            busyLabel={t.habits.form.asking}
          />
          {secondary}
          {caption === undefined ? null : <StatusNote text={caption} align="center" />}
        </>
      }
    >
      <PageHeader title={title} onBack={() => goBack(router)} />
      <FieldRow
        label={t.habits.form.name}
        value={name}
        onChangeText={setName}
        placeholder={t.habits.form.namePlaceholder}
        autoFocus={initial === undefined}
        returnKeyType="done"
      />
      <Section title={t.habits.form.timesPerWeek}>
        {challenge === undefined ? (
          <ChipGroup
            options={options.map((times) => ({
              value: times,
              label: String(times),
              accessibilityLabel: t.habits.form.times(times),
            }))}
            value={weeklyTarget}
            onChange={setWeeklyTarget}
            accessibilityLabel={t.habits.form.timesPerWeek}
          />
        ) : (
          <ListGroup>
            <ListRow
              label={t.habits.form.times(challenge.weeklyTarget)}
              description={t.habits.form.challengeTarget}
            />
            <ListRow
              label={challenge.line}
              onPress={() => router.push({ pathname: '/circle/challenge', params: { id: challenge.id } })}
            />
          </ListGroup>
        )}
      </Section>
      <Section title={t.habits.form.howCounted}>
        <ChoiceCard
          title={t.habits.form.declared}
          description={t.habits.form.declaredDescription}
          selected={verified.countMode === 'declared'}
          onPress={() => setCountMode('declared')}
        />
        {/* When nothing can verify the name the card is off, and its sentence says why. */}
        <ChoiceCard
          title={t.habits.form.verified}
          description={verified.description}
          selected={verified.countMode === 'verified'}
          disabled={!verified.verifiable}
          onPress={() => setCountMode('verified')}
        />
        <StatusNote text={verified.note} />
        {goal === null ? null : <StatusNote text={goal} />}
      </Section>
    </Screen>
  );
}
