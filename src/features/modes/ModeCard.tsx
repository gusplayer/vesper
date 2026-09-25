import { AppIconStack, Button, Card, Check, IconCircle, Stack, Text } from '../../design/components';
import { appsById } from '../../data';
import { modeSummaryText, type AppsSource } from '../../data/modes';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';

type ModeCardProps = {
  /** During a session nothing here may change: no select, no edit, no menu. */
  readOnly?: boolean;
  mode: Mode;
  active: boolean;
  /** Where this mode's apps come from on this phone (features/modes/realBlocking). */
  source: AppsSource;
  /** Tapping the card makes it the active mode. */
  onSelect: () => void;
  onEdit: () => void;
  /** Opens the '…' options sheet. */
  onMore: () => void;
};

/**
 * One mode on the list: name, what it really blocks ('No bloquea apps' is a plain fact),
 * the example tiles where the catalogue stands in, Editar and '…'.
 *
 * The card's own tap activates the mode; Editar and '…' are the card's `actions`,
 * outside that tap, so VoiceOver reaches each of them.
 */
export function ModeCard({ mode, active, source, onSelect, onEdit, onMore, readOnly = false }: ModeCardProps) {
  const t = useStrings();
  // The catalogue's tiles only where the catalogue is the mode's list.
  const apps = source.kind === 'example' ? appsById(mode.appIds) : [];
  const line = modeSummaryText(mode, t.modes, source);
  const state = active ? t.modes.card.active : readOnly ? t.modes.card.readOnly : t.modes.card.tapToActivate;

  return (
    <Card
      onPress={readOnly ? undefined : onSelect}
      selected={active}
      accessibilityLabel={`${mode.name}, ${line}, ${state}`}
      actions={
        readOnly ? undefined : (
          <Stack direction="row" align="center" justify="space-between" gap="md">
            <Button
              variant="secondary"
              size="sm"
              label={t.common.edit}
              accessibilityLabel={t.modes.card.editA11y(mode.name)}
              onPress={onEdit}
            />
            <IconCircle name="more-horizontal" onPress={onMore} accessibilityLabel={t.modes.card.optionsA11y(mode.name)} />
          </Stack>
        )
      }
    >
      <Stack gap="md">
        <Stack direction="row" align="center" gap="md">
          <Stack gap="xs" grow>
            <Text variant="heading">{mode.name}</Text>
            <Text variant="label" tone="secondary">
              {line}
            </Text>
          </Stack>
          <Check checked={active} tone="success" />
        </Stack>
        {apps.length > 0 ? <AppIconStack apps={apps} max={4} /> : null}
      </Stack>
    </Card>
  );
}
