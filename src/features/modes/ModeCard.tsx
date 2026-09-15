import { AppIconStack, Card, Check, IconCircle, Stack, Text } from '../../design/components';
import { appsById } from '../../data';
import { modeSummaryText } from '../../data/modes';
import type { Mode } from '../../data/types';

type ModeCardProps = {
  mode: Mode;
  active: boolean;
  /** Tapping the card makes it the active mode. */
  onSelect: () => void;
  onEdit: () => void;
  /** Opens the '…' options sheet. */
  onMore: () => void;
};

/** One mode on the list: name, what it limits, its app tiles, Editar and '…'. */
export function ModeCard({ mode, active, onSelect, onEdit, onMore }: ModeCardProps) {
  const apps = appsById(mode.appIds);
  return (
    <Card onPress={onSelect} accessibilityLabel={`${mode.name}, ${active ? 'activo' : 'toca para activar'}`}>
      <Stack gap="md">
        <Stack direction="row" align="center" gap="md">
          <Stack gap="xs" grow>
            <Text variant="heading">{mode.name}</Text>
            <Text variant="label" tone="secondary">
              {modeSummaryText(mode)}
            </Text>
          </Stack>
          <Check checked={active} tone="success" />
        </Stack>
        {apps.length > 0 ? <AppIconStack apps={apps} max={4} /> : null}
        <Stack direction="row" align="center" gap="md">
          {/* A muted card, not Button secondary: that pill is the card's own color. */}
          <Stack grow>
            <Card tone="muted" onPress={onEdit} accessibilityLabel={`editar ${mode.name}`}>
              <Text weight="medium" align="center">
                Editar
              </Text>
            </Card>
          </Stack>
          <IconCircle name="more-horizontal" onPress={onMore} accessibilityLabel={`opciones de ${mode.name}`} />
        </Stack>
      </Stack>
    </Card>
  );
}
