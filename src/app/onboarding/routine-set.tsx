import { router } from 'expo-router';

import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, Card, PageHeader, Screen, Stack, Text, Toggle } from '../../design/components';
import { commitOnboarding } from '../../features/onboarding/commit';
import { windowText } from '../../features/schedules/format';

/** A preview of the schedule card as the Rutinas tab will show it, then save. */
export default function RoutineSetScreen() {
  const modeName = useOnboardingDraft((state) => state.modeName);
  const schedule = useOnboardingDraft((state) => state.schedule);

  const save = () => {
    commitOnboarding({ withSchedule: true });
    router.push('/onboarding/notifications');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Guardar rutina" onPress={save} />
          <Button label="Editar rutina" variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />

      <Card>
        <Stack direction="row" align="center" justify="space-between" gap="md">
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {`${modeName} · rutina`}
            </Text>
            <Text variant="label" tone="secondary">
              {windowText(schedule)}
            </Text>
            <Text variant="label" tone="secondary">
              {`Modo: ${modeName}`}
            </Text>
          </Stack>
          {/* A preview: the toggle is drawn on and does nothing yet. */}
          <Toggle value onValueChange={() => undefined} accessibilityLabel="rutina activa" />
        </Stack>
      </Card>

      <Text variant="title">Tu rutina está lista</Text>
      <Text variant="label" tone="secondary">
        Puedes editarla cuando quieras en la pestaña Rutinas.
      </Text>
    </Screen>
  );
}
