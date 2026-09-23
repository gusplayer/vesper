import { useRouter } from 'expo-router';

import { useActiveMode, useAppStore, useSettings } from '../../data';
import { Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { MINUTE, SECOND } from '../../domain/time';
import { ToggleCard } from '../../features/settings/ToggleCard';
import { useStrings } from '../../i18n';
import { durationText, timerText } from '../../lib/format';
import { status } from '../../platform/liveActivity';

/** What the preview shows on the clock. Frozen: it is a picture, not a timer. */
const PREVIEW_REMAINING_MS = 24 * MINUTE + 13 * SECOND;

/**
 * Live Activities: one switch, and a picture of what the lock screen would show. The
 * picture is the banner of src/widgets/FocusActivity.tsx drawn with app components:
 * mode name and status on the left, the clock on the right. When the build cannot
 * show a real one, the platform says why under the switch.
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
      <PageHeader onBack={() => router.back()} title={t.settings.liveActivities.title} />

      <Stack gap="sm">
        <ToggleCard
          title={t.settings.liveActivities.toggleTitle}
          description={t.settings.liveActivities.toggleDescription}
          value={settings.liveActivities}
          onValueChange={(liveActivities) => updateSettings({ liveActivities })}
        />
        {availability.available ? null : (
          <Text variant="caption" tone="secondary">
            {availability.reason}
          </Text>
        )}
      </Stack>

      <Stack gap="sm">
        <Card tone="ink">
          <Stack direction="row" align="center" justify="space-between" gap="md">
            <Stack gap="xs">
              <Text variant="body" weight="semibold" tone="onInk">
                {modeName}
              </Text>
              <Text variant="caption" tone="tertiary">
                {t.settings.liveActivities.previewStatus(durationText(PREVIEW_REMAINING_MS))}
              </Text>
            </Stack>
            <Text variant="heading" tone="onInk">
              {timerText(PREVIEW_REMAINING_MS)}
            </Text>
          </Stack>
        </Card>
        <Text variant="caption" tone="secondary" align="center">
          {t.settings.liveActivities.previewCaption}
        </Text>
      </Stack>
    </Screen>
  );
}
