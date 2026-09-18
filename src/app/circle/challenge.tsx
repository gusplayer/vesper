import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import {
  useAppStore,
  useChallenge,
  useChallengeStandings,
  useCircleStore,
  useNudgesGivenToday,
  useNudgesReceivedToday,
} from '../../data';
import { Button, Card, PageHeader, Screen, Section, Stack, Text } from '../../design/components';
import { challengeStatusText, challengeSummaryText } from '../../features/circle/ChallengeCard';
import { StandingsList } from '../../features/circle/StandingsList';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { status as circleStatus } from '../../platform/circle';

const CLOCK_MS = 60_000;

/** 0 for Monday through 6 for Sunday, matching `Standing.days`. */
function weekdayIndex(now: number): number {
  return (new Date(now).getDay() + 6) % 7;
}

/**
 * One challenge: who delivered what this week, and the one thing the user can do.
 * Joined and active: mark today, which is the mark of the linked habit. Not joined:
 * join, which takes a habit slot or says there is none. Leaving keeps the habit.
 * Next to anyone who has not marked today, a nudge chip: once a day per person,
 * recorded here and delivered once there is a server (ADR-0027).
 */
export default function ChallengeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const strings = useStrings();
  const t = strings.circle;
  const now = useNow(CLOCK_MS);
  const view = useChallenge(id, now);
  const standings = useChallengeStandings(id, now);
  const nudgesGiven = useNudgesGivenToday(now, id);
  const nudgesReceived = useNudgesReceivedToday(now, id);
  const joinChallenge = useCircleStore((state) => state.joinChallenge);
  const leaveChallenge = useCircleStore((state) => state.leaveChallenge);
  const nudge = useCircleStore((state) => state.nudge);
  const toggleHabitToday = useAppStore((state) => state.toggleHabitToday);
  const [habitsFull, setHabitsFull] = useState(false);
  const sync = circleStatus();

  if (view === null) {
    return (
      <Screen>
        <PageHeader onBack={() => router.back()} title={t.list.challenges} />
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.challenge.goneTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.challenge.goneDescription}
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  const { challenge } = view;
  const mine = standings.find((standing) => standing.isMe) ?? null;
  const todayIndex = weekdayIndex(now);
  const markedToday = mine?.days[todayIndex] ?? false;
  const canMark = view.joined && challenge.habitId !== null && view.status === 'active';
  // A nudge is between people who share the challenge, while it runs.
  const canNudge = view.joined && view.status === 'active';

  const join = () => {
    setHabitsFull(joinChallenge(challenge.id, Date.now()) === 'habitsFull');
  };

  const confirmLeave = () => {
    Alert.alert(t.challenge.leaveQuestion, t.challenge.leaveMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.challenge.leaveConfirm, style: 'destructive', onPress: () => leaveChallenge(challenge.id) },
    ]);
  };

  const primary = canMark ? (
    <Button
      label={markedToday ? t.challenge.unmarkToday : t.challenge.markToday}
      onPress={() => {
        if (challenge.habitId !== null) {
          toggleHabitToday(challenge.habitId, Date.now());
        }
      }}
    />
  ) : !view.joined && view.status !== 'ended' ? (
    <Button label={t.challenge.join} onPress={join} />
  ) : null;

  return (
    <Screen
      scroll
      footer={
        primary === null && !view.joined ? undefined : (
          <>
            {primary}
            {habitsFull ? (
              <Text variant="label" tone="danger" align="center">
                {t.challenge.habitsFull}
              </Text>
            ) : null}
            {view.joined ? <Button label={t.challenge.leave} variant="ghost" onPress={confirmLeave} /> : null}
          </>
        )
      }
    >
      <PageHeader onBack={() => router.back()} title={challenge.name} />

      <Stack gap="xs">
        <Text variant="heading">{challengeStatusText(view, t)}</Text>
        <Text variant="label" tone="secondary">
          {challengeSummaryText(view, t)}
        </Text>
      </Stack>

      <Section title={t.challenge.thisWeek}>
        {nudgesReceived.names.length > 0 ? (
          <Text variant="label" tone="secondary">
            {t.challenge.nudgedYou(nudgesReceived.names)}
          </Text>
        ) : null}
        <StandingsList
          standings={standings}
          nudge={
            canNudge
              ? { todayIndex, givenTo: nudgesGiven, onNudge: (toId) => nudge(toId, challenge.id, Date.now()) }
              : undefined
          }
        />
        {canNudge ? (
          <Text variant="caption" tone="tertiary">
            {t.challenge.nudgeHint}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {view.joined ? t.challenge.countsAsHabit : t.challenge.notJoined}
        </Text>
      </Section>

      <Text variant="caption" tone="tertiary" align="center">
        {sync.reason}
      </Text>
    </Screen>
  );
}
