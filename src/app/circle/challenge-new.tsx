import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useState } from 'react';

import { useCircleMembers, useCircleStore, useHabitsWeek } from '../../data';
import { challengeIdeas, type ChallengeIdea } from '../../data/challenges';
import {
  Button,
  Chip,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  StatusNote,
  Toggle,
} from '../../design/components';
import {
  CHALLENGE_DURATION_OPTIONS,
  CHALLENGE_TARGET_OPTIONS,
  DEFAULT_CHALLENGE_DAYS,
  type Habit,
} from '../../domain/types';
import { challengeConsentText } from '../../features/circle/challengeText';
import { healthMissingReason, useAskHealthToJoin } from '../../features/circle/useAskHealthToJoin';
import { MAX_CHALLENGE_NAME } from '../../platform/circleApi';
import { stepGoalText } from '../../features/health/format';
import { useLocale, useStrings } from '../../i18n';
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
 * the line under the button says so, and nothing is created (rule 4, ADR-0021). A
 * steps name says the goal it reads under the field, and a challenge Health can
 * confirm says what joining shares above the button and asks for Health (ADR-0042).
 *
 * Nobody is enrolled behind their back: each person checked here gets the challenge and
 * joins it themselves (`challengeLink`, 'invited'), and the line under the list says so.
 * A challenge with nobody in it cannot be made, and with nobody in the circle the list
 * is the way to invite someone.
 */
export default function NewChallengeScreen() {
  const router = useRouter();
  const strings = useStrings();
  const circle = strings.circle;
  const t = circle.challengeNew;
  const { tag } = useLocale();
  const askHealth = useAskHealthToJoin();
  const [creating, setCreating] = useState(false);
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
  // Joining reuses a habit with the same name as it is, target included (the store never
  // rewrites it), so the challenge takes that target instead of disagreeing with it.
  const lockedTarget = join && fromHabit !== undefined ? fromHabit.habit.weeklyTarget : null;
  const target = lockedTarget ?? weeklyTarget;
  const nobody = !join && participantIds.length === 0;

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

  const goal = stepGoalText(trimmed, strings.habits.form, tag);
  const consent = join ? challengeConsentText(trimmed, circle, tag, healthMissingReason()) : null;

  const create = async () => {
    if (join) {
      setCreating(true);
      await askHealth(trimmed);
      setCreating(false);
    }
    const outcome = createChallenge(
      { name: trimmed, weeklyTarget: target, days, participantIds: [...participantIds], join },
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
      avoidKeyboard
      footer={
        <>
          {consent === null ? null : <StatusNote text={consent} align="center" />}
          <Button label={t.create} onPress={() => void create()} disabled={trimmed === '' || nobody} busy={creating} />
          {habitsFull ? (
            <>
              <StatusNote text={t.habitsFull} tone="danger" align="center" live />
              <Button
                label={circle.challenge.seeHabits}
                variant="ghost"
                onPress={() => router.push({ pathname: '/activity', params: { view: 'lifetime' } })}
              />
            </>
          ) : null}
        </>
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.circle)} title={t.title} />

      <FieldRow
        label={t.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setHabitsFull(false);
        }}
        placeholder={t.namePlaceholder}
        autoFocus
        maxLength={MAX_CHALLENGE_NAME}
      />
      {goal === null ? null : <StatusNote text={goal} />}

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
        <StatusNote text={t.ideasHint} />
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
          <StatusNote text={t.fromHabitHint} />
        </Section>
      )}

      <Section title={t.timesPerWeek}>
        <Stack direction="row" gap="sm" wrap>
          {CHALLENGE_TARGET_OPTIONS.map((times) => (
            <Chip
              key={times}
              label={String(times)}
              selected={target === times}
              accessibilityRole="radio"
              disabled={lockedTarget !== null && lockedTarget !== times}
              onPress={() => setWeeklyTarget(times)}
            />
          ))}
        </Stack>
        {lockedTarget === null ? null : <StatusNote text={t.targetFromHabit} />}
      </Section>

      <Section title={t.duration}>
        <Stack direction="row" gap="sm" wrap>
          {CHALLENGE_DURATION_OPTIONS.map((option) => (
            <Chip
              key={option ?? 'none'}
              label={t.durationOption(option)}
              selected={days === option}
              accessibilityRole="radio"
              onPress={() => setDays(option)}
            />
          ))}
        </Stack>
      </Section>

      <Section title={t.withWhom}>
        {members.length === 0 ? (
          <>
            <StatusNote kind="empty" text={t.noMembers} />
            <ListGroup>
              <ListRow icon="user-plus" label={circle.list.invite} onPress={() => router.push('/circle/invite')} />
            </ListGroup>
          </>
        ) : (
          <ListGroup footer={t.withWhomHint}>
            {members.map((member) => (
              <ListRow
                key={member.id}
                label={member.name}
                description={circle.member.handle(member.handle)}
                selection="checkbox"
                selected={participantIds.includes(member.id)}
                onPress={() => toggleParticipant(member.id)}
              />
            ))}
          </ListGroup>
        )}
        <ListGroup>
          <ListRow
            label={t.meToo}
            description={t.meTooHint}
            right={
              <Toggle
                value={join}
                onValueChange={(value) => {
                  setJoin(value);
                  setHabitsFull(false);
                }}
                accessibilityLabel={t.meToo}
              />
            }
          />
        </ListGroup>
      </Section>
    </Screen>
  );
}
