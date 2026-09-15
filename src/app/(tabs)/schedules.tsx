import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useAppStore, useModes, useRunningSession, useSchedules } from '../../data';
import { modeSummaryText } from '../../data/modes';
import type { Schedule } from '../../data/types';
import {
  Card,
  IconCircle,
  PageHeader,
  ScheduleCard,
  Screen,
  Stack,
  Text,
  Tooltip,
} from '../../design/components';
import { overlapNames, windowText } from '../../features/schedules/format';

/** How long the "not during a session" bubble stays up. */
const TOOLTIP_MS = 2500;

const RUNNING_MESSAGE = 'No se pueden agregar rutinas durante una sesión activa';

/** The line that names the mode on a card. A deleted mode says so instead of hiding. */
const MISSING_MODE_LINE = 'Modo eliminado · apagado';

/**
 * The Rutinas tab: one card per schedule with its toggle, and a plus in the header
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
    AccessibilityInfo.announceForAccessibility(RUNNING_MESSAGE);
    if (tipTimer.current !== null) {
      clearTimeout(tipTimer.current);
    }
    tipTimer.current = setTimeout(() => setTipVisible(false), TOOLTIP_MS);
  };

  const modeLine = (schedule: Schedule): string => {
    const mode = modes.find((candidate) => candidate.id === schedule.modeId);
    return mode === undefined ? MISSING_MODE_LINE : `${mode.name} · ${modeSummaryText(mode)}`;
  };

  const windowLine = (schedule: Schedule): string =>
    schedule.enabled ? windowText(schedule) : `${windowText(schedule)} · apagado`;

  return (
    <Screen scroll inTabs>
      <PageHeader
        title="Rutinas"
        right={<IconCircle name="plus" tone="card" onPress={create} accessibilityLabel="Crear rutina" />}
      />

      {tipVisible ? <Tooltip message={RUNNING_MESSAGE} /> : null}

      {schedules.length === 0 ? (
        <Card tone="muted">
          <Text variant="body" tone="secondary">
            Todavía no hay rutinas. Una rutina enciende un modo sola, a la hora que elijas.
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {schedules.map((schedule) => {
            const crossings = overlapNames(schedule, schedules).map((name) => `Se cruza con ${name}`);
            const lines = [windowLine(schedule), modeLine(schedule), ...crossings];
            return (
              <ScheduleCard
                key={schedule.id}
                title={schedule.name}
                lines={lines}
                enabled={schedule.enabled}
                onToggle={(enabled) => toggleSchedule(schedule.id, enabled)}
                onPress={() => router.push({ pathname: '/schedules/edit', params: { id: schedule.id } })}
                accessibilityLabel={`${schedule.name}, ${lines.join(', ')}. Editar`}
              />
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}
