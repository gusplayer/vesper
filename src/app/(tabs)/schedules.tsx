import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAppStore, useModes, useRunningSession, useSchedules } from '../../data';
import {
  Card,
  IconCircle,
  PageHeader,
  Screen,
  Stack,
  Text,
  Toggle,
  Tooltip,
} from '../../design/components';
import { windowText } from '../../features/schedules/format';

/** How long the "not during a session" bubble stays up. */
const TOOLTIP_MS = 2500;

/**
 * The Horarios tab: one card per schedule with its toggle, and a plus at the bottom
 * to add one. While a session runs, the plus only explains itself.
 */
export default function SchedulesScreen() {
  const router = useRouter();
  const schedules = useSchedules();
  const modes = useModes();
  const running = useRunningSession();
  const toggleSchedule = useAppStore((state) => state.toggleSchedule);

  const [tipVisible, setTipVisible] = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tipTimer.current !== null) {
        clearTimeout(tipTimer.current);
      }
    },
    [],
  );

  const create = () => {
    if (running === null) {
      router.push('/schedules/edit');
      return;
    }
    setTipVisible(true);
    if (tipTimer.current !== null) {
      clearTimeout(tipTimer.current);
    }
    tipTimer.current = setTimeout(() => setTipVisible(false), TOOLTIP_MS);
  };

  const modeName = (modeId: string) => modes.find((mode) => mode.id === modeId)?.name ?? 'Sin modo';

  return (
    <Screen scroll inTabs>
      <PageHeader title="Horarios" />

      {schedules.length === 0 ? (
        <Card tone="muted">
          <Text variant="body" tone="secondary">
            Todavía no hay horarios. Un horario enciende un modo solo, a la hora que elijas.
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {schedules.map((schedule) => (
            <Card
              key={schedule.id}
              onPress={() => router.push({ pathname: '/schedules/edit', params: { id: schedule.id } })}
              accessibilityLabel={`editar ${schedule.name}`}
            >
              <Stack direction="row" align="center" gap="lg">
                <Stack grow gap="xs">
                  <Text variant="body" weight="medium">
                    {schedule.name}
                  </Text>
                  <Text variant="label" tone="secondary">
                    {windowText(schedule)}
                  </Text>
                  <Text variant="label" tone="secondary">
                    {`Modo: ${modeName(schedule.modeId)}`}
                  </Text>
                </Stack>
                <Toggle
                  value={schedule.enabled}
                  onValueChange={(enabled) => toggleSchedule(schedule.id, enabled)}
                  accessibilityLabel={`${schedule.name} encendido`}
                />
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      <Stack align="center" gap="md">
        <Text variant="label" tone="secondary">
          Crear horario
        </Text>
        {tipVisible ? (
          <Tooltip message="No se pueden agregar horarios durante una sesión activa" />
        ) : null}
        <IconCircle name="plus" tone="card" onPress={create} accessibilityLabel="crear horario" />
      </Stack>
    </Screen>
  );
}
