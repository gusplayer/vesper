import { AppIconStack, ListGroup, ListRow, Sheet, Stack, Text } from '../../design/components';
import { appsById, websitesById } from '../../data';
import { modeSummaryText } from '../../data/modes';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';

type ModeDetailsSheetProps = {
  mode: Mode;
  visible: boolean;
  onClose: () => void;
};

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What a mode does, read-only. Shown during a session, when editing is off the table:
 * the person chose this before starting, and the session honors it.
 */
export function ModeDetailsSheet({ mode, visible, onClose }: ModeDetailsSheetProps) {
  const t = useStrings();
  const apps = appsById(mode.appIds);
  const sites = websitesById(mode.websiteIds);
  return (
    <Sheet visible={visible} title={mode.name} onClose={onClose}>
      <Stack gap="lg">
        <Stack gap="xs" align="center">
          <Text variant="label" tone="secondary" align="center">
            {modeSummaryText(mode, t.modes)}
          </Text>
          {apps.length > 0 ? <AppIconStack apps={apps} max={6} /> : null}
        </Stack>
        <ListGroup>
          <ListRow
            label={t.modes.edit.apps}
            value={apps.length === 0 ? t.modes.edit.noApps : apps.map((app) => app.name).join(', ')}
          />
          <ListRow
            label={t.modes.edit.sites}
            value={sites.length === 0 ? t.common.none : sites.map((site) => site.host).join(', ')}
          />
          <ListRow
            label={t.modes.edit.depth}
            description={sentenceCase(t.depth.description[mode.depth])}
            value={sentenceCase(t.depth.label[mode.depth])}
          />
        </ListGroup>
        <Text variant="caption" tone="secondary" align="center">
          {t.modes.details.readOnlyNotice}
        </Text>
      </Stack>
    </Sheet>
  );
}
