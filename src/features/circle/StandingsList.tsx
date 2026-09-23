import type { Standing } from '../../data';
import { Card, Check, Chip, Stack, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { ChallengeWeek } from './ChallengeWeek';

type NudgeProps = {
  /** 0 for Monday through 6 for Sunday: the cell of `Standing.days` that is today. */
  todayIndex: number;
  /** Ids already nudged today: their chip reads 'Empujado' and does nothing. */
  givenTo: ReadonlySet<string>;
  onNudge: (id: string) => void;
};

type StandingsListProps = {
  standings: readonly Standing[];
  /** The day that is today, 0 for Monday, so every week breathes on the same cell. */
  todayIndex: number | null;
  /** When given, everyone else who has not marked today gets a nudge chip (ADR-0027). */
  nudge?: NudgeProps;
};

/**
 * Who delivered what this week: one row per participant with the seven days as a
 * grid, 'done de target', and a check once the target is met. A mark and a dash, no
 * points and no positions (ADR-0021). Without nudge chips the card is one VoiceOver
 * element that reads every row and the grids inside are decoration; with them, each
 * row reads on its own so the chips can be reached.
 */
export function StandingsList({ standings, todayIndex, nudge }: StandingsListProps) {
  const t = useStrings().circle;
  const nameOf = (standing: Standing) => (standing.isMe ? t.member.me : standing.name);
  const progressOf = (standing: Standing) => t.challenge.progress(standing.done, standing.target);
  const spoken = standings
    .map((standing) => t.challenge.standingA11y(nameOf(standing), progressOf(standing), standing.met))
    .join('. ');
  const canNudge = (standing: Standing) =>
    nudge !== undefined && !standing.isMe && !(standing.days[nudge.todayIndex] ?? false);

  return (
    <Card accessibilityLabel={nudge === undefined ? spoken : undefined}>
      <Stack gap="lg">
        {standings.map((standing) => (
          <Stack key={standing.id} gap="sm">
            <Stack direction="row" gap="md" align="center">
              <Stack grow gap="xs">
                <Text variant="body" weight={standing.isMe ? 'medium' : 'regular'}>
                  {nameOf(standing)}
                </Text>
                <ChallengeWeek days={standing.days} todayIndex={todayIndex} />
              </Stack>
              <Text variant="label" tone="secondary">
                {progressOf(standing)}
              </Text>
              <Check checked={standing.met} tone="success" />
            </Stack>
            {nudge !== undefined && canNudge(standing) ? (
              <Stack direction="row" gap="sm">
                <Chip
                  label={nudge.givenTo.has(standing.id) ? t.challenge.nudged : t.challenge.nudge}
                  selected={nudge.givenTo.has(standing.id)}
                  onPress={() => nudge.onNudge(standing.id)}
                  accessibilityLabel={t.challenge.nudgeA11y(standing.name)}
                />
              </Stack>
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
