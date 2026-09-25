import { useRouter } from 'expo-router';

import { useCircleStore, useCircleWeek, useKudosGivenToday, useProfile } from '../../data';
import { ListGroup, ListRow, NoticeCard, Section, StatusNote } from '../../design/components';
import { useStrings } from '../../i18n';
import { challengeOutlookText } from './challengeText';
import { MemberRow } from './MemberRow';
import { useLinkedChallengeWeeks } from './useChallengeLink';
import { useCircleSyncStatus } from './useCircleSyncStatus';

/** How many people the weekly view shows before 'Ver círculo'. */
const PREVIEW_ROWS = 4;

type CircleWeekSectionProps = {
  now: number;
};

/**
 * The circle at the end of Actividad › Semanal (ADR-0021): up to four people with
 * their hours and the cheer chip, and a row to the full screen. Without a profile, a
 * quiet card that invites to create one; with a profile and nobody in it, one that
 * invites to invite. The last line is `platform/circle.status()`: when the circle
 * connects, that the people are samples while they are, or when it last synced.
 */
export function CircleWeekSection({ now }: CircleWeekSectionProps) {
  const t = useStrings().circle;
  const router = useRouter();
  const profile = useProfile();
  const rows = useCircleWeek(now);
  const givenToday = useKudosGivenToday(now);
  const giveKudos = useCircleStore((state) => state.giveKudos);
  const myChallenges = useLinkedChallengeWeeks(now).filter((week) => week.status === 'active');
  const sync = useCircleSyncStatus();

  return (
    <Section title={t.section.title}>
      {profile === null ? (
        <NoticeCard
          title={t.section.noProfileTitle}
          body={t.section.noProfileBody}
          trailing="chevron"
          onPress={() => router.push('/settings/circle')}
          accessibilityHint={t.section.createProfileA11y}
        />
      ) : rows.length === 0 ? (
        <NoticeCard
          title={t.section.emptyTitle}
          body={t.section.emptyBody}
          trailing="chevron"
          onPress={() => router.push('/circle/invite')}
          accessibilityHint={t.section.inviteA11y}
        />
      ) : (
        <>
          <ListGroup>
            {rows.slice(0, PREVIEW_ROWS).map((row) => (
              <MemberRow
                key={row.id}
                row={row}
                kudosGiven={givenToday.has(row.id)}
                onKudos={() => giveKudos(row.id, Date.now())}
              />
            ))}
            <ListRow label={t.section.seeCircle} onPress={() => router.push('/circle')} />
          </ListGroup>
          {myChallenges.length === 0 ? null : (
            <ListGroup title={t.list.challenges}>
              {myChallenges.map((week) => (
                <ListRow
                  key={week.id}
                  label={week.name}
                  description={challengeOutlookText(week.outlook, t)}
                  value={t.challenge.progress(week.done, week.target)}
                  onPress={() => router.push({ pathname: '/circle/challenge', params: { id: week.id } })}
                  accessibilityHint={t.challenge.openA11y(week.name)}
                />
              ))}
            </ListGroup>
          )}
        </>
      )}
      {/* Without a profile nothing of the circle is on screen for the line to speak of. */}
      {profile === null ? null : <StatusNote text={sync.reason} />}
    </Section>
  );
}
