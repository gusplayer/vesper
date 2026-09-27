import { useCircleStore } from '../../data';
import { Button, Stack } from '../../design/components';
import { useStrings } from '../../i18n';

type CheerButtonProps = {
  /** The person, still in the circle. */
  member: { id: string; name: string };
  /** Already cheered today: the pill reads 'Enviado' and rests until tomorrow. */
  given: boolean;
};

/**
 * "Dar ánimo" under a photo (ADR-0051 §9): the same daily cheer as the circle's week,
 * to the person and never to the photo — no reaction, no count. Once a day; once given
 * it reads 'Enviado' and does nothing more.
 */
export function CheerButton({ member, given }: CheerButtonProps) {
  const t = useStrings().circle.member;
  const giveKudos = useCircleStore((state) => state.giveKudos);
  return (
    <Stack direction="row">
      <Button
        size="sm"
        variant="secondary"
        label={given ? t.kudosSent : t.kudos}
        disabled={given}
        onPress={() => giveKudos(member.id, Date.now())}
        accessibilityLabel={given ? t.kudosSentA11y(member.name) : t.kudosA11y(member.name)}
      />
    </Stack>
  );
}
