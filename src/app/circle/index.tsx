import { useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';

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
  NoticeCard,
  PageHeader,
  Screen,
  Section,
  Stack,
  StatusNote,
  Text,
} from '../../design/components';
import { ChallengeCard } from '../../features/circle/ChallengeCard';
import { MemberRow } from '../../features/circle/MemberRow';
import { useCircleSyncStatus, useIsDemoCircle } from '../../features/circle/useCircleSyncStatus';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

/** The circle only needs to notice a new day, not a new second. */
const CLOCK_MS = 60_000;

/**
 * Tu círculo (ADR-0021): the week, ordered by focus hours and nothing else, the
 * challenges, and a way to invite. Without a profile it explains what a circle is
 * and offers to create one; that is the only primary button the screen ever has.
 *
 * While the people are the demo seed's, the page says so at the top, before the user
 * acts on them: inviting someone is what creates the account, and the account is what
 * sends the samples away (ADR-0044). Nobody should vanish without a word.
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
  const sync = useCircleSyncStatus();
  const demo = useIsDemoCircle();
  const invite = () => router.push('/circle/invite');

  if (profile === null) {
    // Nothing of the circle is on screen yet, so there is no line about it either.
    return (
      <Screen footer={<Button label={t.list.createProfile} onPress={() => router.push('/settings/circle')} />}>
        <PageHeader onBack={() => goBack(router)} title={t.list.title} />
        <Stack gap="md">
          <Text variant="title">{t.list.noProfileTitle}</Text>
          <Text tone="secondary">{t.list.noProfileBody}</Text>
          <Text tone="secondary">{t.list.noProfileShare}</Text>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <PageHeader
        onBack={() => goBack(router)}
        title={t.list.title}
        right={<IconCircle name="user-plus" onPress={invite} accessibilityLabel={t.list.inviteA11y} />}
      />

      {demo ? (
        <NoticeCard
          icon="info"
          title={t.list.demoTitle}
          body={t.list.demoBody}
          actionLabel={t.list.invite}
          onAction={invite}
        />
      ) : null}

      {/* Names, not the count: a cheer from someone who left must not leave a line with no name. */}
      {received.names.length > 0 ? (
        <Text variant="label" tone="secondary">
          {t.kudos.received(received.names)}
        </Text>
      ) : null}

      <Section title={t.list.thisWeek}>
        {rows.length === 0 ? (
          <>
            <StatusNote kind="empty" text={t.list.noMembers} />
            <ListGroup>
              <ListRow icon="user-plus" label={t.list.invite} onPress={invite} />
            </ListGroup>
          </>
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
        {challenges.length === 0 ? <StatusNote kind="empty" text={t.list.noChallenges} /> : null}
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

      <StatusNote text={sync.reason} align="center" />
    </Screen>
  );
}
