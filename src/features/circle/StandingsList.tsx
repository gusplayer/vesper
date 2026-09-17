import type { Standing } from '../../data';
import { Card, Check, DotGrid, Stack, Text } from '../../design/components';
import { useStrings } from '../../i18n';

type StandingsListProps = {
  standings: ReadonlyArray<Standing>;
};

/**
 * Who delivered what this week: one row per participant with the seven days as a
 * grid, 'done de target', and a check once the target is met. A mark and a dash, no
 * points and no positions (ADR-0021). The card is one VoiceOver element that reads
 * every row; the grids inside are decoration.
 */
export function StandingsList({ standings }: StandingsListProps) {
  const t = useStrings().circle;
  const nameOf = (standing: Standing) => (standing.isMe ? t.member.me : standing.name);
  const progressOf = (standing: Standing) => t.challenge.progress(standing.done, standing.target);
  const spoken = standings
    .map((standing) => t.challenge.standingA11y(nameOf(standing), progressOf(standing), standing.met))
    .join('. ');

  return (
    <Card accessibilityLabel={spoken}>
      <Stack gap="lg">
        {standings.map((standing) => (
          <Stack key={standing.id} direction="row" gap="md" align="center">
            <Stack grow gap="xs">
              <Text variant="body" weight={standing.isMe ? 'medium' : 'regular'}>
                {nameOf(standing)}
              </Text>
              <DotGrid cells={standing.days} columns={7} />
            </Stack>
            <Text variant="label" tone="secondary">
              {progressOf(standing)}
            </Text>
            <Check checked={standing.met} tone="success" />
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
