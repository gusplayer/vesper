import { useRouter } from 'expo-router';
import { Fragment } from 'react';

import { useDayLedger, useUsage } from '../../data';
import { AppRow, ListGroup, ListRow, Section, StatusNote } from '../../design/components';
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
 * The focus row is the exception and it is drawn here, not asked of the ledger
 * (ADR-0045): a partition has no room for a zero, but the screen that carries the
 * figure the app exists for cannot hide it on the day it reads zero. It is always
 * the first row, and its number is the ledger's own `declaredMs`, not the Focus
 * tab's counter. The two measure different things on purpose: Focus credits a
 * session whole to the day it started, the ledger clips every interval to the day it
 * is partitioning. Taking the counter here would let a part exceed its total the
 * morning after a session crossed midnight, and would leave minutes in no row at
 * all, since 'unregistered' is the complement of the clipped union (ADR-0045).
 *
 * Under it hang the ledger's declared rows, one per activity: its breakdown, the
 * same shape 'redes' already has with its apps. They are drawn as indented ListRows
 * rather than `AppRow subordinate` because an activity is a word, not an app — it
 * has no icon and no color anywhere else in the app (the mode editor picks one with
 * a plain Chip), and an AppTile with its initial would invent an identity for it and
 * read as one more app two rows above the real ones. The icon column indents the
 * label to exactly where the app breakdown's names start (`layout.icon.lg` and
 * `layout.appIcon.sm` are both 24), so both breakdowns line up.
 *
 * Nothing is added across provenances: the total and its parts are both declared
 * time (rule 9), and the estimate row keeps this screen's own wording, which says
 * out loud that it is a floor.
 *
 * Past 6 h of declared time the focus row says the cap was reached (ADR-0010). When
 * the reason for the demo is one the user can fix — usage access, or no real apps in
 * a blocking mode — a row under the list leads there instead of a paragraph of steps.
 */
export function TodaySection({ now }: TodaySectionProps) {
  const t = useStrings();
  const router = useRouter();
  const ledger = useDayLedger(now);
  const usage = useUsage();
  const copy = t.activity.today;
  // The reason is compared as text, the way modes/apps does: `platform/usage` spells it.
  const fix =
    usage.source !== 'demo'
      ? null
      : usage.reason === copy.usage.noUsageAccess
        ? { label: copy.usage.grantAccess, go: () => router.push('/usage-access') }
        : usage.reason === copy.usage.noApps
          ? { label: copy.usage.pickApps, go: () => router.push('/modes') }
          : null;

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
      <ListGroup footer={copy.footer}>
        <ListRow
          label={copy.focused}
          description={ledger.declaredCapped ? copy.capped : undefined}
          value={durationText(ledger.declaredMs)}
        />
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
          if (row.provenance === 'declared') {
            // How the focus row above splits, one line per activity (ADR-0045).
            return (
              <ListRow
                key={row.key}
                icon="corner-down-right"
                label={capitalize(row.label)}
                value={durationText(row.ms)}
              />
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
      {note === null ? null : <StatusNote text={note} />}
      {fix === null ? null : (
        <ListGroup>
          <ListRow label={fix.label} onPress={fix.go} />
        </ListGroup>
      )}
    </Section>
  );
}
