import { useChallengeStandings, useMyChallengeWeeks, type ChallengeView } from '../../data';
import { Card, Stack, Text } from '../../design/components';
import { challengeDays, weekdayIndex } from '../../domain/circle';
import { useStrings, type Strings } from '../../i18n';
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
 */
export function ChallengeCard({ view, now, onPress }: ChallengeCardProps) {
  const t = useStrings().circle;
  const standings = useChallengeStandings(view.challenge.id, now);
  const myWeek = useMyChallengeWeeks(now).find((week) => week.id === view.challenge.id) ?? null;
  const others = standings.filter((standing) => !standing.isMe);
  const active = view.status === 'active';

  return (
    <Card onPress={onPress} accessibilityLabel={t.challenge.openA11y(view.challenge.name)}>
      <Stack gap="sm">
        <Stack gap="xs">
          <Text variant="body" weight="medium">
            {view.challenge.name}
          </Text>
          <Text variant="label" tone="secondary">
            {challengeSummaryText(view, t)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {challengeStatusText(view, t)}
          </Text>
        </Stack>

        {myWeek === null ? null : (
          <Stack gap="xs">
            <ChallengeWeek days={myWeek.days} todayIndex={active ? weekdayIndex(now) : null} />
            <Text variant="label" tone={myWeek.outlook.risk === 'met' ? 'primary' : 'secondary'}>
              {active ? challengeOutlookText(myWeek.outlook, t) : t.challenge.progress(myWeek.done, myWeek.target)}
            </Text>
          </Stack>
        )}

        {others.length === 0 ? null : (
          <Stack gap="xs">
            {others.map((standing) => (
              <Text key={standing.id} variant="label" tone={standing.met ? 'primary' : 'secondary'}>
                {t.challenge.otherLine(standing.name, t.challenge.progress(standing.done, standing.target), standing.met)}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
