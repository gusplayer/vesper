import { ChoiceCard, Stack } from '../../design/components';
import { DEPTHS, type Depth } from '../../domain/types';
import { useStrings } from '../../i18n';

type DepthCardsProps = {
  value: Depth;
  onChange: (depth: Depth) => void;
};

/** Vesper's own setting on a mode: three radio cards, suave / firme / profundo. */
export function DepthCards({ value, onChange }: DepthCardsProps) {
  const t = useStrings();
  return (
    <Stack gap="sm">
      {DEPTHS.map((depth) => (
        <ChoiceCard
          key={depth}
          title={t.depth.label[depth]}
          description={t.depth.description[depth]}
          selected={value === depth}
          onPress={() => onChange(depth)}
        />
      ))}
    </Stack>
  );
}
