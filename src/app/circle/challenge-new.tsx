import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useCircleMembers, useCircleStore, useHabitsWeek } from '../../data';
import { challengeIdeas, type ChallengeIdea } from '../../data/challenges';
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
import {
  CHALLENGE_DURATION_OPTIONS,
  CHALLENGE_TARGET_OPTIONS,
  DEFAULT_CHALLENGE_DAYS,
  type Habit,
} from '../../domain/types';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

const CLOCK_MS = 60_000;
const DEFAULT_TARGET = 4;

/** A challenge's weekly target has to be one of the offered chips. */
function targetOption(value: number): number {
  return (CHALLENGE_TARGET_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_TARGET;
}

/**
 * Nuevo reto: a name (or one of the user's habits, which prefills it), how many times
 * a week, for how long (21 days by default, or no end at all, ADR-0027), and who is
 * in. Joining uses a habit slot: when the five are taken the store says 'habitsFull',
 * the line under the button says so, and nothing is created (rule 4, ADR-0021).
 */
export default function NewChallengeScreen() {
  const router = useRouter();
  const circle = useStrings().circle;
  const t = circle.challengeNew;
  const now = useNow(CLOCK_MS);
  const habits = useHabitsWeek(now);
  const members = useCircleMembers().filter((member) => member.status === 'member');
  const ideas = challengeIdeas(t);
  const createChallenge = useCircleStore((state) => state.createChallenge);

  const [name, setName] = useState('');
  const [weeklyTarget, setWeeklyTarget] = useState<number>(DEFAULT_TARGET);
  const [days, setDays] = useState<number | null>(DEFAULT_CHALLENGE_DAYS);
  const [participantIds, setParticipantIds] = useState<readonly string[]>([]);
  const [join, setJoin] = useState(true);
  const [habitsFull, setHabitsFull] = useState(false);

  const trimmed = name.trim();
  const fromHabit = habits.find((progress) => progress.habit.name.toLowerCase() === trimmed.toLowerCase());

  const prefillFromHabit = (habit: Habit) => {
    setName(habit.name);
    setWeeklyTarget(targetOption(habit.weeklyTarget));
  };

  const prefillFromIdea = (idea: ChallengeIdea) => {
    setName(idea.name);
    setWeeklyTarget(targetOption(idea.weeklyTarget));
    setDays(idea.days);
    setHabitsFull(false);
  };

  const toggleParticipant = (id: string) => {
    setParticipantIds((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  };

  const create = () => {
    const outcome = createChallenge(
      { name: trimmed, weeklyTarget, days, participantIds: [...participantIds], join },
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

      <Section title={t.ideas}>
        <Stack direction="row" gap="sm" wrap>
          {ideas.map((idea) => (
            <Chip
              key={idea.id}
              label={idea.name}
              selected={trimmed.toLowerCase() === idea.name.toLowerCase()}
              onPress={() => prefillFromIdea(idea)}
            />
          ))}
        </Stack>
        <Text variant="caption" tone="tertiary">
          {t.ideasHint}
        </Text>
      </Section>

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

      <Section title={t.duration}>
        <Stack direction="row" gap="sm" wrap>
          {CHALLENGE_DURATION_OPTIONS.map((option) => (
            <Chip
              key={option ?? 'none'}
              label={t.durationOption(option)}
              selected={days === option}
              onPress={() => setDays(option)}
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
                description={circle.member.handle(member.handle)}
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
