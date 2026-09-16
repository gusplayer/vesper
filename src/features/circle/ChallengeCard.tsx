import { useChallengeStandings, type ChallengeView } from '../../data';
import { Card, Stack, Text } from '../../design/components';
import { challengeWeeks } from '../../domain/circle';
import { useStrings, type Strings } from '../../i18n';

type CircleStrings = Strings['circle'];

type ChallengeCardProps = {
  view: ChallengeView;
  now: number;
  onPress: () => void;
};

/** 'Empieza el lunes', 'Quedan 2 semanas', 'Terminó'. */
export function challengeStatusText(view: ChallengeView, t: CircleStrings): string {
  if (view.status === 'upcoming') {
    return t.challenge.status.upcoming;
  }
  if (view.status === 'ended') {
    return t.challenge.status.ended;
  }
  return t.challenge.status.active(view.weeksLeft);
}

/** '4 veces por semana · 2 semanas · con Ana y Luis'. */
export function challengeSummaryText(view: ChallengeView, t: CircleStrings): string {
  const others = view.participants.filter((participant) => !participant.isMe).map((participant) => participant.name);
  const who =
    others.length > 0 ? t.challenge.withNames(others) : view.joined ? t.challenge.alone : t.challenge.nobody;
  return `${t.challenge.summary(view.challenge.weeklyTarget, challengeWeeks(view.challenge))} · ${who}`;
}

/**
 * A challenge at a glance: name, how often and how long, who is in, and one line per
 * participant with this week's count. Tapping opens the challenge.
 */
export function ChallengeCard({ view, now, onPress }: ChallengeCardProps) {
  const t = useStrings().circle;
  const standings = useChallengeStandings(view.challenge.id, now);

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
        {standings.length === 0 ? null : (
          <Stack gap="xs">
            {standings.map((standing) => (
              <Text key={standing.id} variant="label" tone={standing.met ? 'primary' : 'secondary'}>
                {t.challenge.standingLine(
                  standing.isMe ? t.member.me : standing.name,
                  t.challenge.progress(standing.done, standing.target),
                  standing.met,
                )}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
