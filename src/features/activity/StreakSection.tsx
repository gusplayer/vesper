import { useStreak } from '../../data';
import { Card, Section, Stack, StatusNote, Text } from '../../design/components';
import { GRACE_DAYS_PER_MONTH, STREAK_DAY_MIN_MS } from '../../domain/streak';
import { MINUTE } from '../../domain/time';
import { useLocale, useStrings } from '../../i18n';
import { streakDaysText, streakExplainText } from '../streak/streakText';

type StreakSectionProps = {
  now: number;
};

/** The daily streak and the grace left this month. A number and a counter, nothing shines. ADR-0027. */
export function StreakSection({ now }: StreakSectionProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const streak = useStreak(now);

  return (
    <Section title={t.activity.streak.title}>
      <Card>
        <Stack gap="sm">
          <Text variant="heading">{streakDaysText(streak, t, tag)}</Text>
          <Text variant="label" tone="secondary">
            {streakExplainText(streak, t)}
          </Text>
        </Stack>
      </Card>
      <StatusNote text={t.activity.streak.footer(STREAK_DAY_MIN_MS / MINUTE, GRACE_DAYS_PER_MONTH)} />
    </Section>
  );
}
