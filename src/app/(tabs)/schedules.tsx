import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useAppStore, useFocusStore, useModes, useRunningSession, useSchedules } from '../../data';
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
import { manualDurationMs, routineStatus, sortRoutines } from '../../domain/routines';
import { overlapNames, windowText } from '../../features/schedules/format';
import { statusText } from '../../features/schedules/status';
import { useNow } from '../../lib/useNow';

/** How long the "not during a session" bubble stays up. */
const TOOLTIP_MS = 2500;

/** Status lines change by the minute; half a minute keeps them honest without churn. */
const CLOCK_MS = 30_000;

const CREATE_WHILE_RUNNING_MESSAGE = 'No se pueden agregar rutinas durante una sesión activa';
const START_WHILE_RUNNING_MESSAGE = 'Ya hay una sesión en marcha';

/** The line that names the mode on a card. A deleted mode says so instead of hiding. */
const MISSING_MODE_LINE = 'Modo eliminado';

/**
 * The Rutinas tab: one card per routine, ordered by what is running, then what comes
 * soonest, then the ones you start by hand, then the ones that are off. A plus in the
 * header adds one. While a session runs, the plus and the play buttons only explain
 * themselves.
 */
export default function SchedulesScreen() {
  const router = useRouter();
  const now = useNow(CLOCK_MS);
  const schedules = useSchedules();
  const modes = useModes();
  const running = useRunningSession();
  const runningModeId = useFocusStore((state) => state.modeId);
  const toggleSchedule = useAppStore((state) => state.toggleSchedule);

  const [tip, setTip] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tipTimer.current !== null) {
        clearTimeout(tipTimer.current);
      }
    },
    [],
  );

  const explain = (message: string) => {
    setTip(message);
    AccessibilityInfo.announceForAccessibility(message);
    if (tipTimer.current !== null) {
      clearTimeout(tipTimer.current);
    }
    tipTimer.current = setTimeout(() => setTip(null), TOOLTIP_MS);
  };

  const create = () => {
    if (running === null) {
      router.push('/schedules/edit');
      return;
    }
    explain(CREATE_WHILE_RUNNING_MESSAGE);
  };

  const startByHand = (schedule: Schedule) => {
    if (running !== null) {
      explain(START_WHILE_RUNNING_MESSAGE);
      return;
    }
    useFocusStore.getState().start(schedule.modeId, manualDurationMs(schedule), Date.now());
    router.push('/session/active');
  };

  const modeLine = (schedule: Schedule): string => {
    const mode = modes.find((candidate) => candidate.id === schedule.modeId);
    return mode === undefined ? MISSING_MODE_LINE : `${mode.name} · ${modeSummaryText(mode)}`;
  };

  const ordered = sortRoutines(schedules, now);

  return (
    <Screen scroll inTabs>
      <PageHeader
        title="Rutinas"
        right={<IconCircle name="plus" tone="card" onPress={create} accessibilityLabel="Crear rutina" />}
      />

      {tip === null ? null : <Tooltip message={tip} />}

      {ordered.length === 0 ? (
        <Card tone="muted">
          <Text variant="body" tone="secondary">
            Todavía no hay rutinas. Una rutina enciende un modo sola, a la hora que elijas.
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {ordered.map((schedule) => {
            const status = routineStatus(schedule, now);
            const statusLine = statusText(status, now, {
              running: running !== null && runningModeId === schedule.modeId,
              durationMs: schedule.durationMs,
            });
            const crossings = overlapNames(schedule, schedules).map((name) => `Se cruza con ${name}`);
            const manual = schedule.startMinutes === null;
            // Status first. A timed routine keeps its window line (days and end); a manual
            // one does not, since the status line already says 'Cuando quieras · N min'.
            const lines = [
              ...(statusLine === null ? [] : [statusLine]),
              ...(manual ? [] : [windowText(schedule)]),
              modeLine(schedule),
              ...crossings,
            ];
            return (
              <ScheduleCard
                key={schedule.id}
                title={schedule.name}
                lines={lines}
                enabled={schedule.enabled}
                onToggle={(enabled) => toggleSchedule(schedule.id, enabled)}
                action={manual ? { label: `Empezar ${schedule.name}`, onPress: () => startByHand(schedule) } : undefined}
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
