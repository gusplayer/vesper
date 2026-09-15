import { AppIconStack, ListGroup, ListRow, Sheet, Stack, Text } from '../../design/components';
import { appsById, websitesById } from '../../data';
import { modeSummaryText } from '../../data/modes';
import type { Mode } from '../../data/types';
import { DEPTH_DESCRIPTION, DEPTH_LABEL } from '../../lib/labels';

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
  const apps = appsById(mode.appIds);
  const sites = websitesById(mode.websiteIds);
  return (
    <Sheet visible={visible} title={mode.name} onClose={onClose}>
      <Stack gap="lg">
        <Stack gap="xs" align="center">
          <Text variant="label" tone="secondary" align="center">
            {modeSummaryText(mode)}
          </Text>
          {apps.length > 0 ? <AppIconStack apps={apps} max={6} /> : null}
        </Stack>
        <ListGroup>
          <ListRow
            label="Apps"
            value={apps.length === 0 ? 'Ninguna' : apps.map((app) => app.name).join(', ')}
          />
          <ListRow
            label="Sitios"
            value={sites.length === 0 ? 'Ninguno' : sites.map((site) => site.host).join(', ')}
          />
          <ListRow
            label="Profundidad"
            description={sentenceCase(DEPTH_DESCRIPTION[mode.depth])}
            value={sentenceCase(DEPTH_LABEL[mode.depth])}
          />
        </ListGroup>
        <Text variant="caption" tone="secondary" align="center">
          Durante la sesión el modo es de solo lectura.
        </Text>
      </Stack>
    </Sheet>
  );
}
