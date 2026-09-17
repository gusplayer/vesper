import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useCircleMembers, useCircleStore, useHabitsWeek } from '../../data';
import {
  Button,
  Check,
  Chip,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  Text,
} from '../../design/components';
import { CHALLENGE_TARGET_OPTIONS, CHALLENGE_WEEK_OPTIONS, type Habit } from '../../domain/types';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;
const DEFAULT_TARGET = 4;
const DEFAULT_WEEKS = 2;

/** A challenge's weekly target has to be one of the offered chips. */
function targetOption(value: number): number {
  return (CHALLENGE_TARGET_OPTIONS as ReadonlyArray<number>).includes(value) ? value : DEFAULT_TARGET;
}

/**
 * Nuevo reto: a name (or one of the user's habits, which prefills it), how many times
 * a week, for how long, and who is in. Joining uses a habit slot: when the five are
 * taken the store says 'habitsFull', the line under the button says so, and nothing
 * is created (rule 4, ADR-0021).
 */
export default function NewChallengeScreen() {
  const router = useRouter();
  const t = useStrings().circle.challengeNew;
  const now = useNow(CLOCK_MS);
  const habits = useHabitsWeek(now);
  const members = useCircleMembers().filter((member) => member.status === 'member');
  const createChallenge = useCircleStore((state) => state.createChallenge);

  const [name, setName] = useState('');
  const [weeklyTarget, setWeeklyTarget] = useState<number>(DEFAULT_TARGET);
  const [weeks, setWeeks] = useState<number>(DEFAULT_WEEKS);
  const [participantIds, setParticipantIds] = useState<ReadonlyArray<string>>([]);
  const [join, setJoin] = useState(true);
  const [habitsFull, setHabitsFull] = useState(false);

  const trimmed = name.trim();
  const fromHabit = habits.find((progress) => progress.habit.name.toLowerCase() === trimmed.toLowerCase());

  const prefillFromHabit = (habit: Habit) => {
    setName(habit.name);
    setWeeklyTarget(targetOption(habit.weeklyTarget));
  };

  const toggleParticipant = (id: string) => {
    setParticipantIds((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  };

  const create = () => {
    const outcome = createChallenge(
      { name: trimmed, weeklyTarget, weeks, participantIds: [...participantIds], join },
      Date.now(),
    );
    if (outcome === 'habitsFull') {
      setHabitsFull(true);
      return;
    }
    router.replace({ pathname: '/circle/challenge', params: { id: outcome.id } });
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.create} onPress={create} disabled={trimmed === ''} />
          {habitsFull ? (
            <Text variant="label" tone="danger" align="center">
              {t.habitsFull}
            </Text>
          ) : null}
        </>
      }
    >
      <PageHeader onBack={() => router.back()} title={t.title} />

      <FieldRow
        label={t.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setHabitsFull(false);
        }}
        placeholder={t.namePlaceholder}
        autoFocus
      />

      {habits.length === 0 ? null : (
        <Section title={t.fromHabit}>
          <Stack direction="row" gap="sm" wrap>
            {habits.map((progress) => (
              <Chip
                key={progress.habit.id}
                label={progress.habit.name}
                selected={fromHabit?.habit.id === progress.habit.id}
                onPress={() => prefillFromHabit(progress.habit)}
              />
            ))}
          </Stack>
          <Text variant="caption" tone="tertiary">
            {t.fromHabitHint}
          </Text>
        </Section>
      )}

      <Section title={t.timesPerWeek}>
        <Stack direction="row" gap="sm" wrap>
          {CHALLENGE_TARGET_OPTIONS.map((times) => (
            <Chip
              key={times}
              label={String(times)}
              selected={weeklyTarget === times}
              onPress={() => setWeeklyTarget(times)}
            />
          ))}
        </Stack>
      </Section>

      <Section title={t.weeks}>
        <Stack direction="row" gap="sm" wrap>
          {CHALLENGE_WEEK_OPTIONS.map((count) => (
            <Chip
              key={count}
              label={t.weeksOption(count)}
              selected={weeks === count}
              onPress={() => setWeeks(count)}
            />
          ))}
        </Stack>
      </Section>

      <Section title={t.withWhom}>
        {members.length === 0 ? (
          <Text variant="label" tone="secondary">
            {t.noMembers}
          </Text>
        ) : (
          <ListGroup>
            {members.map((member) => (
              <ListRow
                key={member.id}
                label={member.name}
                description={`@${member.handle}`}
                right={<Check checked={participantIds.includes(member.id)} shape="box" />}
                kind="action"
                onPress={() => toggleParticipant(member.id)}
              />
            ))}
          </ListGroup>
        )}
        <Stack direction="row" gap="sm">
          <Chip
            label={t.meToo}
            selected={join}
            onPress={() => {
              setJoin(!join);
              setHabitsFull(false);
            }}
          />
        </Stack>
        <Text variant="caption" tone="tertiary">
          {t.meTooHint}
        </Text>
      </Section>
    </Screen>
  );
}
