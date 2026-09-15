import { useRouter } from 'expo-router';

import { useActiveMode, useAppStore, useSettings } from '../../data';
import { Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { MINUTE, SECOND } from '../../domain/time';
import { ToggleCard } from '../../features/settings/ToggleCard';
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
  const availability = status();

  const modeName = activeMode?.name ?? 'Sin redes';

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title="Live Activities" />

      <Stack gap="sm">
        <ToggleCard
          title="Live Activities"
          description="El timer en la pantalla bloqueada y en la Dynamic Island"
          value={settings.liveActivities}
          onValueChange={(liveActivities) => updateSettings({ liveActivities })}
        />
        {availability.available ? null : (
          <Text variant="caption" tone="tertiary">
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
                {`Enfocado · quedan ${durationText(PREVIEW_REMAINING_MS)}`}
              </Text>
            </Stack>
            <Text variant="heading" tone="onInk">
              {timerText(PREVIEW_REMAINING_MS)}
            </Text>
          </Stack>
        </Card>
        <Text variant="caption" tone="tertiary" align="center">
          Así se ve mientras corre una sesión.
        </Text>
      </Stack>
    </Screen>
  );
}
