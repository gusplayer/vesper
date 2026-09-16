import { todayBounds, USAGE, useTodayFocusMs } from '../../data';
import { ListGroup, ListRow, Section, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';

type TodaySectionProps = {
  now: number;
};

/**
 * Today's ledger in three currencies that are never added together (ADR-0005): what
 * was focused, the floor of what went to social apps (ADR-0004), and the rest.
 */
export function TodaySection({ now }: TodaySectionProps) {
  const t = useStrings();
  const focusMs = useTodayFocusMs(now);
  const usageMs = USAGE.todayMs;
  const { dayStart } = todayBounds(now);
  const unregisteredMs = Math.max(0, now - dayStart - focusMs - usageMs);

  return (
    <Section title={t.activity.today.title}>
      <ListGroup>
        <ListRow label={t.activity.today.focused} value={durationText(focusMs)} />
        <ListRow
          label={t.activity.today.social}
          description={t.activity.today.socialDescription}
          value={`≥ ${durationText(usageMs)}`}
        />
        <ListRow label={t.activity.today.unregistered} value={durationText(unregisteredMs)} />
      </ListGroup>
      <Text variant="caption" tone="tertiary">
        {t.activity.today.footer}
      </Text>
    </Section>
  );
}
