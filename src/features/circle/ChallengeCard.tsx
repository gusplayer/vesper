import { useChallengeStandings, type ChallengeView } from '../../data';
import { Card, Stack, Text } from '../../design/components';
import { challengeDays, weekdayIndex } from '../../domain/circle';
import { useStrings, type Strings } from '../../i18n';
import { useChallengeLink, useLinkedChallengeWeeks } from './useChallengeLink';
import { ChallengeWeek } from './ChallengeWeek';
import { challengeOutlookText } from './challengeText';

type CircleStrings = Strings['circle'];

type ChallengeCardProps = {
  view: ChallengeView;
  now: number;
  onPress: () => void;
};

/** 'Empieza el lunes', 'Quedan 12 días', 'Último día', 'Sin límite', 'Terminó'. */
export function challengeStatusText(view: ChallengeView, t: CircleStrings): string {
  if (view.status === 'upcoming') {
    return t.challenge.status.upcoming;
  }
  if (view.status === 'ended') {
    return t.challenge.status.ended;
  }
  return t.challenge.status.active(view.daysLeft);
}

/** '4 veces por semana · 21 días · con Ana y Luis'. */
export function challengeSummaryText(view: ChallengeView, t: CircleStrings): string {
  const others = view.participants.filter((participant) => !participant.isMe).map((participant) => participant.name);
  const who =
    others.length > 0 ? t.challenge.withNames(others) : view.joined ? t.challenge.alone : t.challenge.nobody;
  const duration = t.challenge.duration(challengeDays(view.challenge));
  return `${t.challenge.summary(view.challenge.weeklyTarget, duration)} · ${who}`;
}

/**
 * A challenge at a glance: the name, how often and with whom, your week as seven
 * days, and the one line that says how it is going. The others get a line each, in
 * words and not in points (ADR-0021). Tapping opens the challenge.
 *
 * A challenge someone added the user to, with no habit of theirs behind it yet, says
 * so where the status goes: it is waiting for them to join (`challengeLink`).
 */
export function ChallengeCard({ view, now, onPress }: ChallengeCardProps) {
  const t = useStrings().circle;
  const standings = useChallengeStandings(view.challenge.id, now);
  const link = useChallengeLink(view.challenge);
  // Only a linked challenge has a week of the user's: an archived habit's marks are not it.
  const myWeek = useLinkedChallengeWeeks(now).find((week) => week.id === view.challenge.id) ?? null;
  const others = standings.filter((standing) => !standing.isMe);
  const active = view.status === 'active';
  const invited = link === 'invited' && view.status !== 'ended';
  const statusLine = invited ? t.challenge.invitedCard : challengeStatusText(view, t);
  const outlookLine =
    myWeek === null
      ? null
      : active
        ? challengeOutlookText(myWeek.outlook, t)
        : t.challenge.progress(myWeek.done, myWeek.target);
  const otherLines = others.map((standing) =>
    t.challenge.otherLine(standing.name, t.challenge.progress(standing.done, standing.target), standing.met),
  );
  // VoiceOver hears what the card shows, in order, not just its name.
  const spoken = t.challenge.cardA11y(
    [view.challenge.name, challengeSummaryText(view, t), statusLine, outlookLine, ...otherLines].filter(
      (part): part is string => part !== null,
    ),
  );

  return (
    <Card onPress={onPress} accessibilityLabel={spoken}>
      <Stack gap="sm">
        <Stack gap="xs">
          <Text variant="body" weight="medium">
            {view.challenge.name}
          </Text>
          <Text variant="label" tone="secondary">
            {challengeSummaryText(view, t)}
          </Text>
          <Text variant="caption" tone="secondary">
            {statusLine}
          </Text>
        </Stack>

        {myWeek === null ? null : (
          <Stack gap="xs">
            <ChallengeWeek days={myWeek.days} todayIndex={active ? weekdayIndex(now) : null} />
            <Text variant="label" tone={myWeek.outlook.risk === 'met' ? 'primary' : 'secondary'}>
              {outlookLine}
            </Text>
          </Stack>
        )}

        {others.length === 0 ? null : (
          <Stack gap="xs">
            {others.map((standing, index) => (
              <Text key={standing.id} variant="label" tone={standing.met ? 'primary' : 'secondary'}>
                {otherLines[index]}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
