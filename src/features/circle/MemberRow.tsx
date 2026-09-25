import type { CircleWeekRow } from '../../data';
import { Avatar, Button, ListRow } from '../../design/components';
import { metricState } from '../../domain/circle';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';

type MemberRowProps = {
  row: CircleWeekRow;
  /** True once the user cheered this person today: the pill reads 'Enviado', and rests. */
  kudosGiven: boolean;
  onKudos: () => void;
};

/**
 * One person of the circle for the week: avatar, name and handle, focus hours, and the
 * estimated social floor on its own line when they share it (never summed, ADR-0005).
 * The cheer is the only gesture: a small pill, once a day, no counter; once sent it
 * reads 'Enviado' and does nothing more until tomorrow. The user's own row says 'Tú'
 * and has none.
 */
export function MemberRow({ row, kudosGiven, onKudos }: MemberRowProps) {
  const t = useStrings().circle.member;
  // Three states, not two: a shared zero is a real empty week, a null is a number its
  // owner keeps, and no row at all is an absence. Collapsing the last two would print
  // "0 min" over someone who simply did not publish (ADR-0033, migration 010).
  const focus = metricState(row.focusMs, row.hasData);
  // The user's own number, kept, is said to them in the second person: 'Tú' is not
  // somebody who "does not share this one".
  const notShared = row.isMe ? t.notSharedMe : t.notShared;
  const focusText =
    focus === 'shared' ? t.focus(durationText(row.focusMs ?? 0)) : focus === 'private' ? notShared : t.noData;
  const lines = [`${t.handle(row.handle)} · ${focusText}`];
  if (metricState(row.socialMs, row.hasData) === 'shared') {
    lines.push(t.social(durationText(row.socialMs ?? 0)));
  }
  return (
    <ListRow
      leading={<Avatar name={row.name} me={row.isMe} />}
      label={row.isMe ? t.me : row.name}
      description={lines.join('\n')}
      right={
        row.isMe ? null : (
          <Button
            size="sm"
            variant="secondary"
            label={kudosGiven ? t.kudosSent : t.kudos}
            disabled={kudosGiven}
            onPress={onKudos}
            accessibilityLabel={kudosGiven ? t.kudosSentA11y(row.name) : t.kudosA11y(row.name)}
          />
        )
      }
    />
  );
}
