import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';

import { useActiveMode, useAppStore, useSettings } from '../../data';
import { Card, PageHeader, Screen, Stack, StatusNote, Text } from '../../design/components';
import { MINUTE, SECOND } from '../../domain/time';
import { ToggleCard } from '../../features/settings/ToggleCard';
import { useStrings } from '../../i18n';
import { timerText } from '../../lib/format';
import { status } from '../../platform/liveActivity';

/** What the preview shows on the clock. Frozen: it is a picture, not a timer. */
const PREVIEW_REMAINING_MS = 24 * MINUTE + 13 * SECOND;

/**
 * Live Activities: one switch, and a picture of what the lock screen would show. The
 * picture is the banner of src/widgets/FocusActivity.tsx drawn with app components:
 * mode name and the phase on the left (the same words the widget receives, never
 * minutes: ADR-0023), the clock on the right. When the phone cannot show a real one
 * (Android, an old iOS, a build without the widget) the switch is dimmed, the platform
 * says why under it, and the picture is not drawn: it would show what never happens.
 */
export default function LiveActivitiesScreen() {
  const router = useRouter();
  const settings = useSettings();
  const activeMode = useActiveMode();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const t = useStrings();
  const availability = status();

  const modeName = activeMode?.name ?? t.settings.liveActivities.previewMode;

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.liveActivities.title} />

      <Stack gap="sm">
        <ToggleCard
          title={t.settings.liveActivities.toggleTitle}
          description={t.settings.liveActivities.toggleDescription}
          value={settings.liveActivities}
          onValueChange={(liveActivities) => updateSettings({ liveActivities })}
          disabled={!availability.available}
        />
        {availability.available || availability.reason === null ? null : <StatusNote text={availability.reason} />}
      </Stack>

      {availability.available ? (
        <Stack gap="sm">
          <Card tone="ink">
            <Stack direction="row" align="center" justify="space-between" gap="md">
              <Stack grow gap="xs">
                <Text variant="body" weight="semibold" tone="onInk">
                  {modeName}
                </Text>
                <Text variant="caption" tone="onInkSecondary">
                  {t.session.liveActivity.statusFocus}
                </Text>
              </Stack>
              <Text variant="heading" tone="onInk">
                {timerText(PREVIEW_REMAINING_MS)}
              </Text>
            </Stack>
          </Card>
          <StatusNote text={t.settings.liveActivities.previewCaption} align="center" />
        </Stack>
      ) : null}
    </Screen>
  );
}
