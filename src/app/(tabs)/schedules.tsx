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
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

/** How long the "not during a session" bubble stays up. */
const TOOLTIP_MS = 2500;

/** Status lines change by the minute; half a minute keeps them honest without churn. */
const CLOCK_MS = 30_000;

/**
 * The Rutinas tab: one card per routine, ordered by what is running, then what comes
 * soonest, then the ones you start by hand, then the ones that are off. A plus in the
 * header adds one. While a session runs, the plus and the play buttons only explain
 * themselves.
 */
export default function SchedulesScreen() {
  const router = useRouter();
  const t = useStrings();
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
    explain(t.routines.list.createWhileRunning);
  };

  const startByHand = (schedule: Schedule) => {
    if (running !== null) {
      explain(t.routines.list.startWhileRunning);
      return;
    }
    useFocusStore.getState().start(schedule.modeId, manualDurationMs(schedule), Date.now());
    router.push('/session/active');
  };

  /** The line that names the mode on a card. A deleted mode says so instead of hiding. */
  const modeLine = (schedule: Schedule): string => {
    const mode = modes.find((candidate) => candidate.id === schedule.modeId);
    return mode === undefined ? t.routines.list.missingMode : `${mode.name} · ${modeSummaryText(mode, t.modes)}`;
  };

  const ordered = sortRoutines(schedules, now);

  return (
    <Screen scroll inTabs>
      <PageHeader
        title={t.common.tabs.routines}
        right={
          <IconCircle name="plus" tone="card" onPress={create} accessibilityLabel={t.routines.list.createA11y} />
        }
      />

      {tip === null ? null : <Tooltip message={tip} />}

      {ordered.length === 0 ? (
        <Card tone="muted">
          <Text variant="body" tone="secondary">
            {t.routines.list.empty}
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {ordered.map((schedule) => {
            const status = routineStatus(schedule, now);
            const statusLine = statusText(status, now, t.routines, {
              running: running !== null && runningModeId === schedule.modeId,
              durationMs: schedule.durationMs,
            });
            const crossings = overlapNames(schedule, schedules).map(t.routines.list.crossesWith);
            const manual = schedule.startMinutes === null;
            // Status first. A timed routine keeps its window line (days and end); a manual
            // one does not, since the status line already says 'Cuando quieras · N min'.
            const lines = [
              ...(statusLine === null ? [] : [statusLine]),
              ...(manual ? [] : [windowText(schedule, t.format)]),
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
                action={
                  manual
                    ? { label: t.routines.list.start(schedule.name), onPress: () => startByHand(schedule) }
                    : undefined
                }
                onPress={() => router.push({ pathname: '/schedules/edit', params: { id: schedule.id } })}
                accessibilityLabel={t.routines.list.cardA11y(schedule.name, lines.join(', '))}
              />
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}
