import { todayBounds, useTodayFocusMs, useUsage } from '../../data';
import { AppRow, ListGroup, ListRow, Section, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { clockText, durationText } from '../../lib/format';

type TodaySectionProps = {
  now: number;
};

/** How many apps the breakdown shows. A ledger, not a ranking (ADR-0029). */
const MAX_APPS = 5;

/**
 * Today's ledger in three currencies that are never added together (ADR-0005): what
 * was focused, the floor of what went to social apps (ADR-0004) with its breakdown
 * by app (ADR-0029), and the rest.
 */
export function TodaySection({ now }: TodaySectionProps) {
  const t = useStrings();
  const focusMs = useTodayFocusMs(now);
  const usage = useUsage();
  const { dayStart } = todayBounds(now);
  const unregisteredMs = Math.max(0, now - dayStart - focusMs - usage.todayMs);
  const copy = t.activity.today;

  const note =
    usage.source === 'device'
      ? usage.readAt === null
        ? null
        : copy.usage.readAt(clockText(usage.readAt))
      : usage.reason === null
        ? copy.usage.demo
        : `${copy.usage.demo} ${usage.reason}`;

  return (
    <Section title={copy.title}>
      <ListGroup>
        <ListRow label={copy.focused} value={durationText(focusMs)} />
        <ListRow label={copy.social} description={copy.socialDescription} value={copy.atLeast(durationText(usage.todayMs))} />
        {usage.byApp.slice(0, MAX_APPS).map((app) => (
          <AppRow
            key={app.id}
            icon={app.icon}
            initial={app.initial}
            color={app.color}
            name={app.name}
            value={copy.atLeast(durationText(app.ms))}
            accessibilityLabel={copy.usage.appLabel(app.name, durationText(app.ms))}
          />
        ))}
        <ListRow label={copy.unregistered} value={durationText(unregisteredMs)} />
      </ListGroup>
      {note === null ? null : (
        <Text variant="caption" tone="tertiary">
          {note}
        </Text>
      )}
      <Text variant="caption" tone="tertiary">
        {copy.footer}
      </Text>
    </Section>
  );
}
