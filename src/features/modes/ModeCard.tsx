import { AppIconStack, Card, Check, IconCircle, Stack, Text } from '../../design/components';
import { appsById } from '../../data';
import { modeSummaryText } from '../../data/modes';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';

type ModeCardProps = {
  /** During a session nothing here may change: no select, no edit, no menu. */
  readOnly?: boolean;
  mode: Mode;
  active: boolean;
  /** Tapping the card makes it the active mode. */
  onSelect: () => void;
  onEdit: () => void;
  /** Opens the '…' options sheet. */
  onMore: () => void;
};

/** One mode on the list: name, what it limits, its app tiles, Editar and '…'. */
export function ModeCard({ mode, active, onSelect, onEdit, onMore, readOnly = false }: ModeCardProps) {
  const t = useStrings();
  const apps = appsById(mode.appIds);
  const state = active ? t.modes.card.active : readOnly ? t.modes.card.readOnly : t.modes.card.tapToActivate;
  return (
    <Card onPress={readOnly ? undefined : onSelect} accessibilityLabel={`${mode.name}, ${state}`}>
      <Stack gap="md">
        <Stack direction="row" align="center" gap="md">
          <Stack gap="xs" grow>
            <Text variant="heading">{mode.name}</Text>
            <Text variant="label" tone="secondary">
              {modeSummaryText(mode, t.modes)}
            </Text>
          </Stack>
          <Check checked={active} tone="success" />
        </Stack>
        {apps.length > 0 ? <AppIconStack apps={apps} max={4} /> : null}
        {readOnly ? null : (
        <Stack direction="row" align="center" gap="md">
          {/* A muted card, not Button secondary: that pill is the card's own color. */}
          <Stack grow>
            <Card tone="muted" onPress={onEdit} accessibilityLabel={t.modes.card.editA11y(mode.name)}>
              <Text weight="medium" align="center">
                {t.common.edit}
              </Text>
            </Card>
          </Stack>
          <IconCircle name="more-horizontal" onPress={onMore} accessibilityLabel={t.modes.card.optionsA11y(mode.name)} />
        </Stack>
        )}
      </Stack>
    </Card>
  );
}
