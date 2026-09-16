import { useRouter } from 'expo-router';

import { useAppStore, useFocusStore, useRunningSession, useSettings } from '../../data';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { Badge } from '../../design/components';
import { useStrings } from '../../i18n';

/**
 * The emergency unlock: ends the running session at once, no waiting, and spends one
 * of the month's allowance. The button only lights up while a session runs.
 */
export default function EmergencyScreen() {
  const router = useRouter();
  const settings = useSettings();
  const running = useRunningSession();
  const spendEmergency = useAppStore((state) => state.useEmergency);
  const t = useStrings();

  const canUse = running !== null && settings.emergencyLeft > 0;

  const unlock = () => {
    spendEmergency();
    // Why the session ended, as the ledger will read it: written in the language of the moment.
    useFocusStore.getState().finish('cancelled', Date.now(), t.settings.emergency.exitReason);
    router.replace('/(tabs)');
  };

  return (
    <Screen
      scroll
      footer={
        <Button label={t.settings.emergency.use} variant="secondary" onPress={unlock} disabled={!canUse} />
      }
    >
      <PageHeader onBack={() => router.back()} title={t.settings.emergency.title} />

      <Card>
        <Stack direction="row" align="flex-start" gap="md">
          <Stack grow gap="xs">
            <Text variant="body" weight="medium">
              {t.settings.emergency.cardTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.settings.emergency.cardDescription}
            </Text>
          </Stack>
          <Badge label={t.settings.emergency.left(settings.emergencyLeft)} />
        </Stack>
      </Card>

      <Stack gap="xs">
        <Text variant="caption" tone="tertiary" align="center">
          {t.settings.emergency.perMonth(settings.emergencyTotal)}
        </Text>
        {running === null ? (
          <Text variant="caption" tone="tertiary" align="center">
            {t.settings.emergency.onlyWhileRunning}
          </Text>
        ) : null}
      </Stack>
    </Screen>
  );
}
