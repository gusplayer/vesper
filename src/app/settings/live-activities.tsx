import { useRouter } from 'expo-router';

import { useActiveMode, useAppStore, useSettings } from '../../data';
import { Card, Icon, PageHeader, Screen, Stack, Text } from '../../design/components';
import { ToggleCard } from '../../features/settings/ToggleCard';

/** What the preview shows on the clock. Frozen: it is a picture, not a timer. */
const PREVIEW_TIMER = '24:13';

/** Live Activities: one switch, and a picture of what the lock screen would show. */
export default function LiveActivitiesScreen() {
  const router = useRouter();
  const settings = useSettings();
  const activeMode = useActiveMode();
  const updateSettings = useAppStore((state) => state.updateSettings);

  const modeName = activeMode?.name ?? 'Sin redes';

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title="Live Activities" />

      <ToggleCard
        title="Live Activities"
        description="El timer en la pantalla bloqueada y en la Dynamic Island"
        value={settings.liveActivities}
        onValueChange={(liveActivities) => updateSettings({ liveActivities })}
      />

      <Stack gap="sm">
        <Card tone="ink">
          <Stack direction="row" align="center" gap="md">
            <Icon name="clock" size="md" tone="onInk" />
            <Stack grow gap="xs">
              <Text variant="body" tone="onInk">
                {`${modeName} · ${PREVIEW_TIMER}`}
              </Text>
              <Text variant="caption" tone="onInk">
                Enfocado
              </Text>
            </Stack>
          </Stack>
        </Card>
        <Text variant="caption" tone="tertiary" align="center">
          Así se ve mientras corre una sesión.
        </Text>
      </Stack>
    </Screen>
  );
}
