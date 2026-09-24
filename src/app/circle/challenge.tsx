import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import {
  useAppStore,
  useSettings,
  useChallenge,
  useChallengeStandings,
  useChallengeWeeks,
  useCircleStore,
  useMyChallengeWeeks,
  useNudgesGivenToday,
  useNudgesReceivedToday,
} from '../../data';
import {
  Button,
  Card,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  Text,
} from '../../design/components';
import { challengeDays, challengeWeeksMet, weekdayIndex } from '../../domain/circle';
import { isMarkedByHealth } from '../../domain/habits';
import { ME } from '../../domain/types';
import { challengeStatusText, challengeSummaryText } from '../../features/circle/ChallengeCard';
import { ChallengeWeek } from '../../features/circle/ChallengeWeek';
import { challengeConsentText, challengeOutlookText } from '../../features/circle/challengeText';
import { StandingsList } from '../../features/circle/StandingsList';
import { useAskHealthToJoin } from '../../features/circle/useAskHealthToJoin';
import { useLocale, useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { status as circleStatus } from '../../platform/circle';

const CLOCK_MS = 60_000;

/**
 * One challenge. Your week is the page: seven days drawn, today breathing, and one
 * line that says what is missing and how much room is left (ADR-0031). Under it, the
 * others, with a nudge for whoever has not marked today — once a day per person,
 * recorded here and delivered once there is a server (ADR-0027).
 *
 * Joined and active, the one button marks today, which is the mark of the linked
 * habit. Not joined, it joins, which takes a habit slot or says there is none. When
 * Health can confirm the challenge, the line above the button says what joining
 * shares, and joining asks for Health first (ADR-0042).
 * Leaving keeps the habit. A challenge that ran out has no button: it has how it
 * went, and the offer to run it again.
 */
export default function ChallengeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const strings = useStrings();
  const t = strings.circle;
  const now = useNow(CLOCK_MS);
  const view = useChallenge(id, now);
  const standings = useChallengeStandings(id, now);
  const weeks = useChallengeWeeks(id, now);
  const myWeek = useMyChallengeWeeks(now).find((week) => week.id === id) ?? null;
  const nudgesGiven = useNudgesGivenToday(now, id);
  const nudgesReceived = useNudgesReceivedToday(now, id);
  const createChallenge = useCircleStore((state) => state.createChallenge);
  const joinChallenge = useCircleStore((state) => state.joinChallenge);
  const leaveChallenge = useCircleStore((state) => state.leaveChallenge);
  const archiveChallenge = useCircleStore((state) => state.archiveChallenge);
  const nudge = useCircleStore((state) => state.nudge);
  const toggleHabitToday = useAppStore((state) => state.toggleHabitToday);
  const habits = useAppStore((state) => state.habits);
  const settings = useSettings();
  const [habitsFull, setHabitsFull] = useState(false);
  const [joining, setJoining] = useState(false);
  const askHealth = useAskHealthToJoin();
  const { tag } = useLocale();
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
  const todayIndex = weekdayIndex(now);
  const active = view.status === 'active';
  const others = standings.filter((standing) => !standing.isMe);
  // The week the page draws is the one the standings are on: while it runs that is this
  // week, and once it is over it is the challenge's last one. Reading "0 de 4" over a
  // week the challenge was not running in is worse than saying nothing.
  const mine = standings.find((standing) => standing.isMe) ?? null;
  const markedToday = myWeek?.markedToday ?? false;
  const linked = habits.find((habit) => habit.id === challenge.habitId) ?? null;
  // Health marks a verified habit on its own; a tap would be a declared mark in its place.
  const byHealth = linked !== null && isMarkedByHealth(linked, settings.healthConnected);
  const canMark = view.joined && challenge.habitId !== null && active && !byHealth;
  // A nudge is between people who share the challenge, while it runs.
  const canNudge = view.joined && active;
  const duration = t.challenge.duration(challengeDays(challenge));

  const join = async () => {
    setJoining(true);
    await askHealth(challenge.name);
    setJoining(false);
    setHabitsFull(joinChallenge(challenge.id, Date.now()) === 'habitsFull');
  };
  const consent = view.joined ? null : challengeConsentText(challenge.name, t, tag);

  const confirmLeave = () => {
    Alert.alert(t.challenge.leaveQuestion, t.challenge.leaveMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.challenge.leaveConfirm, style: 'destructive', onPress: () => leaveChallenge(challenge.id) },
    ]);
  };

  const confirmArchive = () => {
    Alert.alert(t.challenge.ended.archiveQuestion, t.challenge.ended.archiveMessage, [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.challenge.ended.archiveConfirm,
        style: 'destructive',
        onPress: () => {
          archiveChallenge(challenge.id, Date.now());
          router.back();
        },
      },
    ]);
  };

  // Running it again is the same promise with the same people, starting this Monday.
  // The old one is archived: it is over, and two of the same name would be one too many.
  const repeat = () => {
    const outcome = createChallenge(
      {
        name: challenge.name,
        weeklyTarget: challenge.weeklyTarget,
        days: challengeDays(challenge),
        participantIds: challenge.participantIds.filter((participantId) => participantId !== ME),
        join: true,
      },
      Date.now(),
    );
    if (outcome === 'habitsFull') {
      setHabitsFull(true);
      return;
    }
    archiveChallenge(challenge.id, Date.now());
    router.replace({ pathname: '/circle/challenge', params: { id: outcome.id } });
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
  ) : view.joined && active && byHealth ? (
    <Text variant="caption" tone="secondary" align="center">
      {t.challenge.markedByHealth}
    </Text>
  ) : !view.joined && view.status !== 'ended' ? (
    <>
      {consent === null ? null : (
        <Text variant="caption" tone="secondary" align="center">
          {consent}
        </Text>
      )}
      <Button label={t.challenge.join} onPress={() => void join()} busy={joining} />
    </>
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
            {view.joined && view.status !== 'ended' ? (
              <Button label={t.challenge.leave} variant="ghost" onPress={confirmLeave} />
            ) : null}
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

      {mine === null || myWeek === null ? null : (
        <Stack align="center" gap="sm">
          <ChallengeWeek
            days={mine.days}
            todayIndex={active ? todayIndex : null}
            labels={strings.format.weekdayInitials}
            size="md"
          />
          <Stack align="center" gap="xs">
            <Text variant="heading">{t.challenge.progress(mine.done, mine.target)}</Text>
            <Text variant="label" tone="secondary">
              {active
                ? challengeOutlookText(myWeek.outlook, t)
                : view.status === 'ended'
                  ? t.challenge.ended.lastWeek
                  : t.challenge.outlook.notStarted}
            </Text>
          </Stack>
        </Stack>
      )}

      {view.status === 'ended' && weeks.length > 0 ? (
        <Section title={t.challenge.ended.title}>
          <Card>
            <Stack gap="sm">
              <Text variant="body" weight="medium">
                {t.challenge.ended.weeks(challengeWeeksMet(weeks).met, weeks.length)}
              </Text>
              <ChallengeWeek days={weeks.map((week) => week.met)} todayIndex={null} />
            </Stack>
          </Card>
          <ListGroup>
            <ListRow icon="repeat" label={t.challenge.ended.repeat(duration)} onPress={repeat} />
            <ListRow icon="archive" label={t.challenge.ended.archive} onPress={confirmArchive} />
          </ListGroup>
        </Section>
      ) : null}

      <Section title={t.challenge.thisWeek}>
        {nudgesReceived.names.length > 0 ? (
          <Text variant="label" tone="secondary">
            {t.challenge.nudgedYou(nudgesReceived.names)}
          </Text>
        ) : null}
        {others.length === 0 ? (
          <Text variant="label" tone="secondary">
            {t.challengeNew.noMembers}
          </Text>
        ) : (
          <StandingsList
            standings={others}
            todayIndex={todayIndex}
            nudge={
              canNudge
                ? { todayIndex, givenTo: nudgesGiven, onNudge: (toId) => nudge(toId, challenge.id, Date.now()) }
                : undefined
            }
          />
        )}
        {canNudge && others.length > 0 ? (
          <Text variant="caption" tone="tertiary">
            {t.challenge.nudgeHint}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {view.joined ? t.challenge.countsAsHabit : t.challenge.notJoined}
        </Text>
      </Section>

      <Text variant="caption" tone="secondary" align="center">
        {sync.reason}
      </Text>
    </Screen>
  );
}
