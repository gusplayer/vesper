import { router } from 'expo-router';
import { useEffect } from 'react';

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

/**
 * Notifications. Also the point where the mode must exist whether or not the user
 * made a routine, so the commit runs here if routine-set did not.
 */
export default function NotificationsScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);

  useEffect(() => {
    commitOnboarding({ withSchedule: false });
  }, []);

  const next = () => router.push('/onboarding/tour');

  const allow = () => {
    updateSettings({ notificationsAllowed: true });
    next();
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Permitir notificaciones" onPress={allow} />
          <Button label="Ahora no" variant="ghost" onPress={next} />
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="caption" tone="tertiary" align="center">
        Seguí en camino
      </Text>
      <Text variant="title" align="center">
        Sacale el jugo a Vesper
      </Text>
      <Text variant="label" tone="secondary" align="center">
        Permití notificaciones para avisos a tiempo que te ayuden a cumplir.
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
              Vesper lo recupera. Empezá una sesión.
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
