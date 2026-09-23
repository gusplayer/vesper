import { Fragment } from 'react';

import { useDayLedger, useUsage } from '../../data';
import { AppRow, ListGroup, ListRow, Section, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { clockText, durationText } from '../../lib/format';
import { capitalize } from './dates';

type TodaySectionProps = {
  now: number;
};

/**
 * Today's ledger (ADR-0010, ADR-0038). The rows come from `domain/ledger`, so the
 * last one is the part of the day no interval covers — a complement, not a
 * subtraction — and the social estimate sits beside it instead of inside it
 * (ADR-0004). Three provenances that are never added together (ADR-0005).
 *
 * The estimate keeps this screen's own wording, which says out loud that it is a
 * floor; only the activity rows are labelled by the ledger, from the table the
 * sessions point at.
 */
export function TodaySection({ now }: TodaySectionProps) {
  const t = useStrings();
  const ledger = useDayLedger(now);
  const usage = useUsage();
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
        {ledger.rows.map((row) => {
          if (row.key === 'usage') {
            // The breakdown hangs off this row, so it is rendered with it and never
            // drifts below 'sin registrar' (ADR-0029 §3).
            return (
              <Fragment key={row.key}>
                <ListRow
                  label={copy.social}
                  description={copy.socialDescription}
                  value={copy.atLeast(durationText(row.ms))}
                />
                {usage.byApp.map((app) => (
                  <AppRow
                    key={app.id}
                    subordinate
                    icon={app.icon}
                    initial={app.initial}
                    color={app.color}
                    name={app.name}
                    value={copy.atLeast(durationText(app.ms))}
                    accessibilityLabel={copy.usage.appLabel(app.name, durationText(app.ms))}
                  />
                ))}
              </Fragment>
            );
          }
          return (
            <ListRow
              key={row.key}
              label={row.key === 'unknown' ? copy.unregistered : capitalize(row.label)}
              value={durationText(row.ms)}
            />
          );
        })}
      </ListGroup>
      {note === null ? null : (
        <Text variant="caption" tone="secondary">
          {note}
        </Text>
      )}
      <Text variant="caption" tone="tertiary">
        {copy.footer}
      </Text>
    </Section>
  );
}
