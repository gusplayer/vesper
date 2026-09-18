import { useStreak } from '../../data';
import { Card, Section, Stack, Text } from '../../design/components';
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
      <Text variant="caption" tone="tertiary">
        {t.activity.streak.footer}
      </Text>
    </Section>
  );
}
