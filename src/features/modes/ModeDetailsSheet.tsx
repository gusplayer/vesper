import { AppIconStack, ListGroup, ListRow, Sheet, Stack, StatusNote, Text } from '../../design/components';
import { appsById, websitesById } from '../../data';
import { modeSummaryText } from '../../data/modes';
import type { Depth } from '../../domain/types';
import type { Mode } from '../../data/types';
import { useStrings } from '../../i18n';
import { status as blockingStatus } from '../../platform/blocking';
import { appsSource, showsSites } from './realBlocking';

type ModeDetailsSheetProps = {
  mode: Mode;
  visible: boolean;
  onClose: () => void;
  /**
   * The depth the session runs at, when it differs from the mode's: a deep mode with
   * no time limit runs as firm (ADR-0022). Defaults to the mode's own.
   */
  depth?: Depth;
};

/**
 * What a mode does, read-only. Shown during a session, when editing is off the table:
 * the person chose this before starting, and the session honors it.
 *
 * One app list per mode (ADR-0047 §2): where the phone has a real picker the apps row
 * is the real selection — or "Ninguna", a plain fact — and there are no sites; where
 * only the catalogue exists it is listed as an example, under the reason this phone
 * cannot block.
 */
export function ModeDetailsSheet({ mode, visible, onClose, depth }: ModeDetailsSheetProps) {
  const t = useStrings();
  const blocking = blockingStatus();
  const source = appsSource(mode, blocking);
  const apps = source.kind === 'example' ? appsById(mode.appIds) : [];
  const sites = showsSites(blocking) ? websitesById(mode.websiteIds) : null;
  const shownDepth = depth ?? mode.depth;
  const appsValue =
    source.kind === 'real'
      ? (source.selection ?? t.modes.edit.noApps)
      : apps.length === 0
        ? t.modes.edit.noApps
        : String(apps.length);
  return (
    <Sheet visible={visible} title={mode.name} onClose={onClose}>
      <Stack gap="lg">
        <Stack gap="xs" align="center">
          <Text variant="label" tone="secondary" align="center">
            {modeSummaryText(mode, t.modes, source)}
          </Text>
          {apps.length > 0 ? <AppIconStack apps={apps} max={6} /> : null}
        </Stack>
        <ListGroup>
          <ListRow
            label={t.modes.edit.apps}
            value={appsValue}
            description={apps.length === 0 ? undefined : apps.map((app) => app.name).join(', ')}
          />
          {sites === null ? null : (
            <ListRow
              label={t.modes.edit.sites}
              value={sites.length === 0 ? t.common.none : String(sites.length)}
              description={sites.length === 0 ? undefined : sites.map((site) => site.host).join(', ')}
            />
          )}
          <ListRow
            label={t.modes.edit.depth}
            description={t.depth.description[shownDepth]}
            value={t.depth.label[shownDepth]}
          />
        </ListGroup>
        {blocking.available || blocking.reason === null ? null : (
          <StatusNote text={t.modes.list.cannotBlock(blocking.reason)} icon="info" align="center" />
        )}
        <StatusNote text={t.modes.details.readOnlyNotice} align="center" />
      </Stack>
    </Sheet>
  );
}
