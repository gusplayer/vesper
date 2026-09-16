import { useRouter } from 'expo-router';

import {
  useChallenges,
  useCircleStore,
  useCircleWeek,
  useKudosGivenToday,
  useKudosReceived,
  useProfile,
} from '../../data';
import {
  Button,
  IconCircle,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Stack,
  Text,
} from '../../design/components';
import { ChallengeCard } from '../../features/circle/ChallengeCard';
import { MemberRow } from '../../features/circle/MemberRow';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { status as circleStatus } from '../../platform/circle';

/** The circle only needs to notice a new day, not a new second. */
const CLOCK_MS = 60_000;

/**
 * Tu círculo (ADR-0021): the week, ordered by focus hours and nothing else, the
 * challenges, and a way to invite. Without a profile it explains what a circle is
 * and offers to create one; that is the only primary button the screen ever has.
 */
export default function CircleScreen() {
  const router = useRouter();
  const t = useStrings().circle;
  const now = useNow(CLOCK_MS);
  const profile = useProfile();
  const rows = useCircleWeek(now);
  const givenToday = useKudosGivenToday(now);
  const received = useKudosReceived(now);
  const challenges = useChallenges(now);
  const giveKudos = useCircleStore((state) => state.giveKudos);
  const sync = circleStatus();

  if (profile === null) {
    return (
      <Screen footer={<Button label={t.list.createProfile} onPress={() => router.push('/settings/circle')} />}>
        <PageHeader onBack={() => router.back()} title={t.list.title} />
        <Stack gap="md">
          <Text variant="title">{t.list.noProfileTitle}</Text>
          <Text tone="secondary">{t.list.noProfileBody}</Text>
          <Text tone="secondary">{t.list.noProfileShare}</Text>
        </Stack>
        <Text variant="caption" tone="tertiary">
          {sync.reason}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <PageHeader
        onBack={() => router.back()}
        title={t.list.title}
        right={
          <IconCircle
            name="user-plus"
            onPress={() => router.push('/circle/invite')}
            accessibilityLabel={t.list.inviteA11y}
          />
        }
      />

      {received.count > 0 ? (
        <Text variant="label" tone="secondary">
          {t.kudos.received(received.names)}
        </Text>
      ) : null}

      <Section title={t.list.thisWeek}>
        {rows.length === 0 ? (
          <Text variant="label" tone="secondary">
            {t.list.noMembers}
          </Text>
        ) : (
          <ListGroup>
            {rows.map((row) => (
              <MemberRow
                key={row.id}
                row={row}
                kudosGiven={givenToday.has(row.id)}
                onKudos={() => giveKudos(row.id, Date.now())}
              />
            ))}
          </ListGroup>
        )}
      </Section>

      <Section title={t.list.challenges}>
        {challenges.length === 0 ? (
          <Text variant="label" tone="secondary">
            {t.list.noChallenges}
          </Text>
        ) : null}
        {challenges.map((view) => (
          <ChallengeCard
            key={view.challenge.id}
            view={view}
            now={now}
            onPress={() => router.push({ pathname: '/circle/challenge', params: { id: view.challenge.id } })}
          />
        ))}
        <ListGroup>
          <ListRow icon="plus" label={t.list.newChallenge} onPress={() => router.push('/circle/challenge-new')} />
        </ListGroup>
      </Section>

      <Text variant="caption" tone="tertiary" align="center">
        {sync.reason}
      </Text>
    </Screen>
  );
}
