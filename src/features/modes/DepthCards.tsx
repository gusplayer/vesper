import { Card, Check, Stack, Text } from '../../design/components';
import { DEPTHS, type Depth } from '../../domain/types';
import { DEPTH_DESCRIPTION, DEPTH_LABEL } from '../../lib/labels';

type DepthCardsProps = {
  value: Depth;
  onChange: (depth: Depth) => void;
};

/** The labels file speaks lowercase; the prototype's copy is in sentence case. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Vesper's own setting on a mode: three radio cards, suave / firme / profundo. */
export function DepthCards({ value, onChange }: DepthCardsProps) {
  return (
    <Stack gap="sm">
      {DEPTHS.map((depth) => (
        <Card key={depth} onPress={() => onChange(depth)} accessibilityLabel={DEPTH_LABEL[depth]}>
          <Stack direction="row" align="center" gap="md">
            <Stack gap="xs" grow>
              <Text weight="medium">{sentence(DEPTH_LABEL[depth])}</Text>
              <Text variant="label" tone="secondary">
                {sentence(DEPTH_DESCRIPTION[depth])}
              </Text>
            </Stack>
            <Check checked={value === depth} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
