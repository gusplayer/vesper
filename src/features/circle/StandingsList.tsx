import type { Standing } from '../../data';
import { Button, Card, Check, Stack, Text } from '../../design/components';
import type { ChallengePhoto } from '../../domain/types';
import { useStrings } from '../../i18n';
import { ChallengeWeek } from './ChallengeWeek';
import { standingSourceText } from './challengeText';

type NudgeProps = {
  /** 0 for Monday through 6 for Sunday: the cell of `Standing.days` that is today. */
  todayIndex: number;
  /** Ids already nudged today: their pill reads 'Empujado' and rests. */
  givenTo: ReadonlySet<string>;
  onNudge: (id: string) => void;
};

type PhotoProps = {
  /**
   * One per day of a person's week, Monday first: the photo pinned to that day where
   * the day is marked (`weekPhotos`), null otherwise. Hidden people come back all null.
   */
  of: (standing: Standing) => readonly (ChallengePhoto | null)[];
  /** Opens a photo (`circle/photo`). */
  onOpen: (id: string) => void;
};

type StandingsListProps = {
  standings: readonly Standing[];
  /** The day that is today, 0 for Monday, so every week breathes on the same cell. */
  todayIndex: number | null;
  /** When given, everyone else who has not marked today gets a nudge pill (ADR-0027). */
  nudge?: NudgeProps;
  /**
   * A challenge with photos, seen by someone in it (ADR-0051): each week is drawn large,
   * under its name, and a marked day with a photo holds its thumbnail and opens it.
   */
  photos?: PhotoProps;
};

/**
 * Who delivered what this week: one row per participant with the seven days as a
 * grid, 'done de target', a check once the target is met, and under the name how the
 * week was counted ('con Salud', 'marcado a mano', ADR-0042). A mark and a dash, no
 * points and no positions (ADR-0021). Without nudge pills or photos the card is one
 * VoiceOver element that reads every row and the grids inside are decoration; with
 * them, each row reads on its own so the pills and the photos can be reached.
 *
 * With photos the week leaves the name's line and takes the card's width at 'lg', the
 * size of your own week above: a thumbnail at 16 pt would be a smudge. A photo still
 * on its way holds the waiting fill; nothing says "new" and nothing counts them.
 */
export function StandingsList({ standings, todayIndex, nudge, photos }: StandingsListProps) {
  const t = useStrings().circle;
  const nameOf = (standing: Standing) => (standing.isMe ? t.member.me : standing.name);
  const progressOf = (standing: Standing) => t.challenge.progress(standing.done, standing.target);
  const spoken = standings
    .map((standing) => {
      const line = t.challenge.standingA11y(nameOf(standing), progressOf(standing), standing.met);
      const source = standingSourceText(standing.source, t);
      return source === null ? line : `${line}, ${source}`;
    })
    .join('. ');
  const canNudge = (standing: Standing) =>
    nudge !== undefined && !standing.isMe && !(standing.days[nudge.todayIndex] ?? false);
  const oneElement = nudge === undefined && photos === undefined;

  return (
    <Card accessibilityLabel={oneElement ? spoken : undefined}>
      <Stack gap="lg">
        {standings.map((standing) => (
          <Stack key={standing.id} gap="sm">
            <Stack direction="row" gap="md" align="center">
              <Stack grow gap="xs">
                <Text variant="body" weight={standing.isMe ? 'medium' : 'regular'}>
                  {nameOf(standing)}
                </Text>
                {standing.source === null ? null : (
                  <Text variant="caption" tone="secondary">
                    {standingSourceText(standing.source, t)}
                  </Text>
                )}
                {photos === undefined ? <ChallengeWeek days={standing.days} todayIndex={todayIndex} /> : null}
              </Stack>
              <Text variant="label" tone="secondary">
                {progressOf(standing)}
              </Text>
              <Check checked={standing.met} tone="success" />
            </Stack>
            {photos === undefined ? null : (
              <ChallengeWeek
                days={standing.days}
                todayIndex={todayIndex}
                size="lg"
                photos={photos.of(standing)}
                onOpenPhoto={photos.onOpen}
                ownerName={standing.name}
              />
            )}
            {nudge !== undefined && canNudge(standing) ? (
              <Stack direction="row" gap="sm">
                <Button
                  size="sm"
                  variant="secondary"
                  label={nudge.givenTo.has(standing.id) ? t.challenge.nudged : t.challenge.nudge}
                  disabled={nudge.givenTo.has(standing.id)}
                  onPress={() => nudge.onNudge(standing.id)}
                  accessibilityLabel={
                    nudge.givenTo.has(standing.id)
                      ? t.challenge.nudgedA11y(standing.name)
                      : t.challenge.nudgeA11y(standing.name)
                  }
                />
              </Stack>
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
