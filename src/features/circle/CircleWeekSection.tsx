import { useRouter } from 'expo-router';

import { useCircleStore, useCircleWeek, useKudosGivenToday, useMyChallengeWeeks, useProfile } from '../../data';
import { Card, ListGroup, ListRow, Section, Stack, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { status as circleStatus } from '../../platform/circle';
import { challengeOutlookText } from './challengeText';
import { MemberRow } from './MemberRow';

/** How many people the weekly view shows before 'Ver círculo'. */
const PREVIEW_ROWS = 4;

type CircleWeekSectionProps = {
  now: number;
};

/**
 * The circle at the end of Actividad › Semanal (ADR-0021): up to four people with
 * their hours and the cheer chip, and a row to the full screen. Without a profile, a
 * quiet card that invites to create one; with a profile and nobody in it, one that
 * invites to invite. The last line says nothing here is synced yet.
 */
export function CircleWeekSection({ now }: CircleWeekSectionProps) {
  const t = useStrings().circle;
  const router = useRouter();
  const profile = useProfile();
  const rows = useCircleWeek(now);
  const givenToday = useKudosGivenToday(now);
  const giveKudos = useCircleStore((state) => state.giveKudos);
  const myChallenges = useMyChallengeWeeks(now).filter((week) => week.status === 'active');
  const sync = circleStatus();

  return (
    <Section title={t.section.title}>
      {profile === null ? (
        <Card onPress={() => router.push('/settings/circle')} accessibilityLabel={t.section.createProfileA11y}>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.section.noProfileTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.section.noProfileBody}
            </Text>
          </Stack>
        </Card>
      ) : rows.length === 0 ? (
        <Card onPress={() => router.push('/circle/invite')} accessibilityLabel={t.section.inviteA11y}>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.section.emptyTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.section.emptyBody}
            </Text>
          </Stack>
        </Card>
      ) : (
        <ListGroup>
          {rows.slice(0, PREVIEW_ROWS).map((row) => (
            <MemberRow
              key={row.id}
              row={row}
              kudosGiven={givenToday.has(row.id)}
              onKudos={() => giveKudos(row.id, Date.now())}
            />
          ))}
          {myChallenges.map((week) => (
            <ListRow
              key={week.id}
              label={week.name}
              description={challengeOutlookText(week.outlook, t)}
              value={t.challenge.progress(week.done, week.target)}
              onPress={() => router.push({ pathname: '/circle/challenge', params: { id: week.id } })}
              accessibilityLabel={t.challenge.openA11y(week.name)}
            />
          ))}
          <ListRow label={t.section.seeCircle} onPress={() => router.push('/circle')} />
        </ListGroup>
      )}
      <Text variant="caption" tone="tertiary">
        {sync.reason}
      </Text>
    </Section>
  );
}
