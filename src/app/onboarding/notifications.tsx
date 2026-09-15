import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAppStore } from '../../data';
import {
  Button,
  Card,
  IconCircle,
  PageHeader,
  Screen,
  Stack,
  Text,
} from '../../design/components';
import { commitOnboarding } from '../../features/onboarding/commit';
import { requestPermission } from '../../platform/notifications';

/**
 * Notifications. Also the point where the mode must exist whether or not the user
 * made a routine, so the commit runs here if routine-set did not.
 *
 * "Permitir" shows the real system prompt and moves on whatever the answer: the
 * flag records what the OS said, and Ajustes › Notificaciones can retry later.
 */
export default function NotificationsScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    commitOnboarding({ withSchedule: false });
  }, []);

  const next = () => router.push('/onboarding/tour');

  const allow = async () => {
    setAsking(true);
    const granted = await requestPermission();
    setAsking(false);
    updateSettings({ notificationsAllowed: granted });
    next();
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label="Permitir notificaciones"
            onPress={() => void allow()}
            busy={asking}
            busyLabel="Pidiendo permiso…"
          />
          <Button label="Ahora no" variant="ghost" onPress={next} disabled={asking} />
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="caption" tone="tertiary" align="center">
        Sigue en camino
      </Text>
      <Text variant="title" align="center">
        Sácale el jugo a Vesper
      </Text>
      <Text variant="label" tone="secondary" align="center">
        Permite notificaciones para avisos a tiempo que te ayuden a cumplir.
      </Text>

      {/* A fake notification, the way one would land on the lock screen. */}
      <Card>
        <Stack direction="row" align="flex-start" gap="md">
          <IconCircle name="clock" />
          <Stack grow gap="xs">
            <Text variant="body" weight="medium">
              El tiempo se escapa
            </Text>
            <Text variant="label" tone="secondary">
              Vesper lo recupera. Empieza una sesión.
            </Text>
          </Stack>
          <Text variant="caption" tone="tertiary">
            ahora
          </Text>
        </Stack>
      </Card>
    </Screen>
  );
}
