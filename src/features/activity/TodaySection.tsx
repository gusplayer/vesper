import { todayBounds, USAGE, useTodayFocusMs } from '../../data';
import { ListGroup, ListRow, Section, Text } from '../../design/components';
import { durationText } from '../../lib/format';

type TodaySectionProps = {
  now: number;
};

/**
 * Today's ledger in three currencies that are never added together (ADR-0005): what
 * was focused, the floor of what went to social apps (ADR-0004), and the rest.
 */
export function TodaySection({ now }: TodaySectionProps) {
  const focusMs = useTodayFocusMs(now);
  const usageMs = USAGE.todayMs;
  const { dayStart } = todayBounds(now);
  const unregisteredMs = Math.max(0, now - dayStart - focusMs - usageMs);

  return (
    <Section title="Hoy">
      <ListGroup>
        <ListRow label="Enfocado" value={durationText(focusMs)} />
        <ListRow
          label="Redes (estimado)"
          description="siempre un piso, nunca exacto"
          value={`≥ ${durationText(usageMs)}`}
        />
        <ListRow label="Sin registrar" value={durationText(unregisteredMs)} />
      </ListGroup>
      <Text variant="caption" tone="tertiary">
        Tres monedas separadas. Nunca se suman.
      </Text>
    </Section>
  );
}
