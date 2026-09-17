import type { CircleWeekRow } from '../../data';
import { Avatar, Chip, ListRow } from '../../design/components';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';

type MemberRowProps = {
  row: CircleWeekRow;
  /** True once the user cheered this person today: the chip reads 'Enviado'. */
  kudosGiven: boolean;
  onKudos: () => void;
};

/**
 * One person of the circle for the week: avatar, name and handle, focus hours, and the
 * estimated social floor on its own line when they share it (never summed, ADR-0005).
 * The kudos chip is the only gesture: once a day, no counter. The user's own row says
 * 'Tú' and has no chip.
 */
export function MemberRow({ row, kudosGiven, onKudos }: MemberRowProps) {
  const t = useStrings().circle.member;
  const lines = [`@${row.handle} · ${row.hasData ? t.focus(durationText(row.focusMs)) : t.noData}`];
  if (row.hasData && row.socialMs !== null) {
    lines.push(t.social(durationText(row.socialMs)));
  }
  return (
    <ListRow
      leading={<Avatar name={row.name} me={row.isMe} />}
      label={row.isMe ? t.me : row.name}
      description={lines.join('\n')}
      right={
        row.isMe ? null : (
          <Chip label={kudosGiven ? t.kudosSent : t.kudos} selected={kudosGiven} onPress={onKudos} />
        )
      }
    />
  );
}
