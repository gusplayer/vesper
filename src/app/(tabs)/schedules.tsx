import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppStore, useFocusStore, useModes, useRunningSession, useSchedules, useSettings } from '../../data';
import { modeSummaryText, usePlannedStore } from '../../data/modes';
import type { Schedule } from '../../data/types';
import {
  IconCircle,
  NoticeCard,
  PageHeader,
  ScheduleCard,
  Screen,
  Stack,
  useTooltip,
} from '../../design/components';
import { manualDurationMs, routineStatus, sortRoutines } from '../../domain/routines';
import { appsSource, grantableToggle } from '../../features/modes/realBlocking';
import { exactAlarmsOff } from '../../features/schedules/exactAlarms';
import { overlapNames, windowText } from '../../features/schedules/format';
import { statusText } from '../../features/schedules/status';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { requestAuthorization, requestExactAlarms, status as blockingStatus } from '../../platform/blocking';

/** Status lines change by the minute; half a minute keeps them honest without churn. */
const CLOCK_MS = 30_000;

/**
 * The Rutinas tab: one card per routine, ordered by what is running, then what comes
 * soonest, then the ones you start by hand, then the ones that are off. A plus in the
 * header adds one. While a session runs, the plus and the play buttons only explain
 * themselves.
 *
 * Every card names its mode and what it really blocks; "No bloquea apps" is a plain
 * fact, not a fault (ADR-0047 §1). A routine whose mode was deleted says so and only
 * opens the editor: it can neither start nor be switched on with no mode. Where this
 * phone cannot block at all, one card above the list says so, with the way in on
 * Android. Play on a deep mode goes to Focus with the mode and length ready, where the
 * button is held (ADR-0047 §3a).
 */
export default function SchedulesScreen() {
  const router = useRouter();
  const t = useStrings();
  const now = useNow(CLOCK_MS);
  // The windows the engine already started: they read as 'started', not 'active'.
  const starts = useSettings().routineStarts;
  const schedules = useSchedules();
  const modes = useModes();
  const running = useRunningSession();
  const runningModeId = useFocusStore((state) => state.modeId);
  const toggleSchedule = useAppStore((state) => state.toggleSchedule);
  const setActiveMode = useAppStore((state) => state.setActiveMode);

  const tooltip = useTooltip();

  // The blocking status, re-read whenever the tab comes back into view: the user may
  // have granted the access, or flipped Android's exact-alarm toggle, and returned.
  const [blocking, setBlocking] = useState(() => blockingStatus());
  const [granting, setGranting] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setBlocking(blockingStatus());
    }, []),
  );
  const turnOnAlarms = () => {
    void requestExactAlarms().then(() => setBlocking(blockingStatus()));
  };
  const missing = grantableToggle(blocking);
  const grant = () => {
    if (granting) {
      return;
    }
    if (missing === 'usageAccess') {
      router.push('/usage-access');
      return;
    }
    // Only the overlay is left: no Play disclosure for it, the page opens directly.
    setGranting(true);
    void requestAuthorization().then(() => {
      setGranting(false);
      setBlocking(blockingStatus());
    });
  };

  const explain = tooltip.show;

  const create = () => {
    if (running === null) {
      router.push('/schedules/edit');
      return;
    }
    explain(t.routines.list.createWhileRunning);
  };

  const edit = (schedule: Schedule) => router.push({ pathname: '/schedules/edit', params: { id: schedule.id } });

  const modeOf = (schedule: Schedule) => modes.find((candidate) => candidate.id === schedule.modeId);

  // The tap's moment comes in as a parameter, the way the store takes `now`: the row's
  // handler reads the clock, not a helper the list closes over while rendering.
  const startByHand = (schedule: Schedule, tappedAt: number) => {
    const mode = modeOf(schedule);
    if (mode === undefined) {
      // No mode, nothing to start: a session would run with no mode at all.
      edit(schedule);
      return;
    }
    if (running !== null) {
      explain(t.routines.list.startWhileRunning);
      return;
    }
    if (mode.depth === 'deep') {
      // Deep is only ever started by holding the Focus button (ADR-0022, ADR-0047 §3a):
      // the play gets the mode and the length ready there, and the hold starts it.
      // Focus reads `routine` to say which routine it has ready, while the mode and the
      // length still match.
      setActiveMode(mode.id);
      usePlannedStore.getState().setPlannedMs(manualDurationMs(schedule));
      router.navigate({ pathname: '/', params: { routine: schedule.id } });
      return;
    }
    useFocusStore.getState().start(schedule.modeId, manualDurationMs(schedule), tappedAt);
    router.push('/session/active');
  };

  const toggle = (schedule: Schedule, enabled: boolean) => {
    if (enabled && modeOf(schedule) === undefined) {
      // Switching on a routine whose mode is gone would start sessions with no mode.
      edit(schedule);
      return;
    }
    toggleSchedule(schedule.id, enabled);
  };

  /**
   * The line that names the mode on a card, with what it really blocks — 'No bloquea
   * apps' is a plain fact, a gym routine may want exactly that (ADR-0047 §1) — or, when
   * the mode is gone, the warning: that routine cannot run until it gets one.
   */
  const modeLines = (schedule: Schedule): { line: string | null; warning: string | undefined } => {
    const mode = modeOf(schedule);
    if (mode === undefined) {
      return { line: null, warning: t.routines.list.missingMode };
    }
    return { line: `${mode.name} · ${modeSummaryText(mode, t.modes, appsSource(mode, blocking))}`, warning: undefined };
  };

  const ordered = sortRoutines(schedules, now, starts);
  // Exact alarms only matter for timed windows the OS can open, so the card only shows
  // where the phone blocks and some timed routine is on.
  const showAlarms =
    blocking.available &&
    exactAlarmsOff(blocking) &&
    schedules.some((schedule) => schedule.enabled && schedule.startMinutes !== null);

  return (
    <Screen scroll inTabs>
      <PageHeader
        title={t.common.tabs.routines}
        right={<IconCircle name="plus" onPress={create} accessibilityLabel={t.routines.list.createA11y} />}
      />

      {tooltip.element}

      {blocking.available || blocking.reason === null ? null : (
        <NoticeCard
          tone="muted"
          icon="info"
          body={t.routines.list.cannotBlock(blocking.reason)}
          actionLabel={missing === null ? undefined : granting ? t.modes.usageAccess.opening : t.routines.list.grantAccess}
          onAction={missing === null ? undefined : grant}
        />
      )}

      {showAlarms ? (
        <NoticeCard
          tone="muted"
          icon="clock"
          body={t.routines.list.exactAlarmsOff}
          actionLabel={t.routines.list.exactAlarmsTurnOn}
          onAction={turnOnAlarms}
        />
      ) : null}

      {ordered.length === 0 ? (
        <NoticeCard body={t.routines.list.empty} actionLabel={t.routines.list.create} onAction={create} />
      ) : (
        <Stack gap="md">
          {ordered.map((schedule) => {
            const status = routineStatus(schedule, now, starts);
            // An open window the engine has not started while a session runs is
            // waiting for it (ADR-0019); only the routine's own mode reads as running.
            const statusLine = statusText(status, now, t.routines, {
              running: running !== null && runningModeId === schedule.modeId && status.kind === 'started',
              waiting: running !== null && status.kind === 'active',
              open: schedule.startMinutes !== null && schedule.endMinutes === null,
              durationMs: schedule.durationMs,
            });
            const crossings = overlapNames(schedule, schedules).map(t.routines.list.crossesWith);
            const manual = schedule.startMinutes === null;
            // Status first. A timed routine keeps its window line (days and end); a manual
            // one does not, since the status line already says 'Cuando quieras · N min'.
            const { line, warning } = modeLines(schedule);
            const lines = [
              ...(statusLine === null ? [] : [statusLine]),
              ...(manual ? [] : [windowText(schedule, t.format, t.routines.edit.nextDay)]),
              ...(line === null ? [] : [line]),
              ...crossings,
            ];
            // A routine whose mode is gone can neither start nor be switched on: the
            // card only opens the editor, where a new mode is picked.
            const modeMissing = modeOf(schedule) === undefined;
            return (
              <ScheduleCard
                key={schedule.id}
                title={schedule.name}
                lines={lines}
                warning={warning}
                warningTone={modeMissing ? 'danger' : 'secondary'}
                enabled={schedule.enabled}
                control={modeMissing ? 'none' : manual ? 'play' : 'toggle'}
                onToggle={(enabled) => toggle(schedule, enabled)}
                action={
                  manual
                    ? {
                        label:
                          modeOf(schedule)?.depth === 'deep'
                            ? t.routines.list.prepare(schedule.name)
                            : t.routines.list.start(schedule.name),
                        onPress: () => startByHand(schedule, Date.now()),
                      }
                    : undefined
                }
                onPress={() => edit(schedule)}
                accessibilityLabel={t.routines.list.cardA11y(
                  schedule.name,
                  [...lines, ...(warning === undefined ? [] : [warning])].join(', '),
                  !schedule.enabled,
                )}
              />
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}
