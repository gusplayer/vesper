import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAppStore, useChallengesByHabit, useHabitsWeek, useSettings } from '../../data';
import { Chip, ListGroup, ListRow, Section, Sheet, Text, Tooltip } from '../../design/components';
import { isMarkedByHealth, type HabitProgress } from '../../domain/habits';
import { MAX_HABITS } from '../../domain/types';
import { useStrings } from '../../i18n';
import { habitProgressText } from '../../lib/format';
import { syncedText } from '../health/format';

type HabitsSectionProps = {
  now: number;
};

const TOOLTIP_MS = 2500;

/**
 * This week's habits: a tap marks today, 'Editar hábitos' opens a sheet that leads to
 * the edit screen. Counts, never time (domain/habits.ts). While Health is connected a
 * verified habit is Health's to mark: a tap only says so (ADR-0005).
 */
export function HabitsSection({ now }: HabitsSectionProps) {
  const t = useStrings();
  const router = useRouter();
  const habits = useHabitsWeek(now);
  const challengesByHabit = useChallengesByHabit(now);
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

  // Without Health the verified habit still takes a tap, and the row says the mark
  // is manual: declared time, never mixed with verified (ADR-0005).
  const verifiedText = settings.healthConnected
    ? t.habits.section.verifiedSynced(syncedText(settings.healthSyncedAt, t.habits))
    : t.habits.section.verifiedNoHealth;

  // A habit that is also a challenge says so: the same marks, with witnesses (ADR-0031).
  const descriptionFor = (progress: HabitProgress) => {
    const challenge = challengesByHabit.get(progress.habit.id);
    if (challenge !== undefined) {
      return t.circle.challenge.habitLine(challenge.others);
    }
    return progress.habit.countMode === 'verified' ? verifiedText : t.habits.section.declared;
  };

  // Before ADR-0041 the editor could save 'verified' for a name nothing maps to; such a
  // habit is not locked, so it can still be marked by hand (domain/habits.ts).
  const lockedByHealth = (progress: HabitProgress) => isMarkedByHealth(progress.habit, settings.healthConnected);

  // The tap's moment comes in as a parameter, the way the store takes `now`: the row's
  // handler reads the clock, not a helper the list closes over while rendering.
  const press = (progress: HabitProgress, tappedAt: number) => {
    if (!lockedByHealth(progress)) {
      toggleHabitToday(progress.habit.id, tappedAt);
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
      return t.habits.section.markedByHealth(progress.habit.name);
    }
    return progress.markedToday
      ? t.habits.section.unmarkToday(progress.habit.name)
      : t.habits.section.markToday(progress.habit.name);
  };

  return (
    <Section title={t.habits.section.title}>
      {tipVisible ? <Tooltip message={t.habits.section.healthTip} /> : null}
      <ListGroup>
        {habits.map((progress) => (
          <ListRow
            key={progress.habit.id}
            label={progress.habit.name}
            description={descriptionFor(progress)}
            value={habitProgressText(progress, t.format)}
            right={
              lockedByHealth(progress) ? (
                <Text variant="caption" tone={progress.markedToday ? 'primary' : 'tertiary'}>
                  {progress.markedToday ? t.habits.section.todayMarked : t.habits.section.todayUnmarked}
                </Text>
              ) : (
                <Chip
                  label={progress.markedToday ? t.habits.section.todayMarked : t.habits.section.today}
                  selected={progress.markedToday}
                  onPress={() => press(progress, Date.now())}
                />
              )
            }
            onPress={() => press(progress, Date.now())}
            accessibilityLabel={accessibilityLabelFor(progress)}
          />
        ))}
        {habits.length === 0 ? null : (
          <ListRow label={t.habits.section.edit} onPress={() => setEditing(true)} />
        )}
        {full ? null : (
          <ListRow label={t.habits.section.add} icon="plus" onPress={() => router.push('/habits/new')} />
        )}
      </ListGroup>
      <Text variant="caption" tone="tertiary">
        {settings.healthConnected ? t.habits.section.helpHealth : t.habits.section.help}
      </Text>
      {full ? (
        <Text variant="caption" tone="tertiary">
          {t.habits.section.fiveIsMax}
        </Text>
      ) : null}
      <Sheet visible={editing} title={t.habits.section.edit} onClose={() => setEditing(false)}>
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
