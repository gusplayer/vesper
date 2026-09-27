import { useMemo } from 'react';

import { useShieldSummary } from '../../data';
import { isQuiet } from '../../domain/shieldTally';
import { AppRow, ListGroup, ListRow, Section } from '../../design/components';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { useLaunchableApps } from '../modes/useLaunchableApps';

type ShieldSectionProps = {
  span: 'today' | 'week';
  now: number;
};

/**
 * What the shield saw (ADR-0053), today under the ledger in De por vida and this week in
 * Semanal: the attempts with a line per app hanging from them, the times the user went
 * back to focus, and the breaks taken from the shield with what they took. Counts and
 * breaks, never time in an app, and nothing here joins the ledger's currencies (rule 9).
 *
 * An app gets its line only when the phone can name it: Android asks its launcher list
 * (the same one the mode picker reads); iOS never can outside the shield (ADR-0004), so
 * there the total stands alone and says it is a floor. Nothing at all is drawn on a day
 * the shield saw nothing.
 */
export function ShieldSection({ span, now }: ShieldSectionProps) {
  const t = useStrings();
  const copy = t.activity.shield;
  const summary = useShieldSummary(span, now);
  const apps = useLaunchableApps(summary.byApp.length > 0);
  const named = useMemo(() => new Map((apps ?? []).map((app) => [app.id, app])), [apps]);

  if (isQuiet(summary)) {
    return null;
  }
  const footer = summary.floor ? `${copy.footer} ${copy.floor}` : copy.footer;
  return (
    <Section title={span === 'today' ? copy.title : copy.titleWeek}>
      <ListGroup footer={footer}>
        <ListRow label={copy.attempts} value={copy.count(summary.attempts, summary.floor)} />
        {summary.byApp.map((line) => {
          const app = named.get(line.token);
          if (app === undefined || app.tile === undefined || (line.attempts === 0 && line.breaks === 0)) {
            return null;
          }
          return (
            <AppRow
              key={line.token}
              subordinate
              icon={app.tile.icon ?? null}
              initial={app.tile.initial}
              color={app.tile.color ?? null}
              name={app.label}
              value={copy.appValue(line.attempts, line.breaks)}
              accessibilityLabel={copy.appLabel(app.label, line.attempts, line.breaks)}
            />
          );
        })}
        {summary.backs === 0 ? null : <ListRow label={copy.backs} value={String(summary.backs)} />}
        {summary.breaks === 0 ? null : (
          <ListRow label={copy.breaks} value={copy.breaksValue(summary.breaks, durationText(summary.breakMs))} />
        )}
      </ListGroup>
    </Section>
  );
}
