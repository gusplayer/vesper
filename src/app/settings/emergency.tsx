import { useRouter } from 'expo-router';

import { useAppStore, useFocusStore, useRunningSession, useSettings } from '../../data';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { Badge } from '../../design/components';

/** Why a session ended this way, as the ledger will read it. */
const EXIT_REASON = 'emergencia';

/**
 * The emergency unlock: ends the running session at once, no waiting, and spends one
 * of the month's allowance. The button only lights up while a session runs.
 */
export default function EmergencyScreen() {
  const router = useRouter();
  const settings = useSettings();
  const running = useRunningSession();
  const spendEmergency = useAppStore((state) => state.useEmergency);

  const canUse = running !== null && settings.emergencyLeft > 0;

  const unlock = () => {
    spendEmergency();
    useFocusStore.getState().finish('cancelled', Date.now(), EXIT_REASON);
    router.replace('/(tabs)');
  };

  return (
    <Screen
      scroll
      footer={
        <Button
          label="Usar desbloqueo de emergencia"
          variant="secondary"
          onPress={unlock}
          disabled={!canUse}
        />
      }
    >
      <PageHeader onBack={() => router.back()} title="Desbloqueo de emergencia" />

      <Card>
        <Stack direction="row" align="flex-start" gap="md">
          <Stack grow gap="xs">
            <Text variant="body" weight="medium">
              Desbloqueo de emergencia
            </Text>
            <Text variant="label" tone="secondary">
              Termina una sesión sin esperar cuando de verdad lo necesitas
            </Text>
          </Stack>
          <Badge label={`${settings.emergencyLeft} restantes`} />
        </Stack>
      </Card>

      <Stack gap="xs">
        <Text variant="caption" tone="tertiary" align="center">
          {`Tienes ${settings.emergencyTotal} por mes. Suficientes para una emergencia real, no para el scroll.`}
        </Text>
        {running === null ? (
          <Text variant="caption" tone="tertiary" align="center">
            Se habilita mientras corre una sesión.
          </Text>
        ) : null}
      </Stack>
    </Screen>
  );
}
