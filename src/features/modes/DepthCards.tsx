import { Card, Check, Stack, Text } from '../../design/components';
import { DEPTHS, type Depth } from '../../domain/types';
import { useStrings } from '../../i18n';

type DepthCardsProps = {
  value: Depth;
  onChange: (depth: Depth) => void;
};

/** The dictionary speaks lowercase; the prototype's copy is in sentence case. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Vesper's own setting on a mode: three radio cards, suave / firme / profundo. */
export function DepthCards({ value, onChange }: DepthCardsProps) {
  const t = useStrings();
  return (
    <Stack gap="sm">
      {DEPTHS.map((depth) => (
        <Card key={depth} onPress={() => onChange(depth)} accessibilityLabel={t.depth.label[depth]}>
          <Stack direction="row" align="center" gap="md">
            <Stack gap="xs" grow>
              <Text weight="medium">{sentence(t.depth.label[depth])}</Text>
              <Text variant="label" tone="secondary">
                {sentence(t.depth.description[depth])}
              </Text>
            </Stack>
            <Check checked={value === depth} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
