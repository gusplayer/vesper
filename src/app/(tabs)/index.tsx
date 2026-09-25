import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import {
  Button,
  Card,
  HeatGrid,
  HoldButton,
  InkFlood,
  Screen,
  Spacer,
  Stack,
  StatusNote,
  Tappable,
  Text,
} from '../../design/components';
import {
  useActiveMode,
  useAppStore,
  useDayStats,
  useFocusStore,
  useHasDemoData,
  useMode,
  useModes,
  useRunningSession,
  useSchedules,
  useSettings,
  useStreak,
  useTodayFocusMs,
} from '../../data';
import { usePlannedStore } from '../../data/modes';
import { weekdayIndex } from '../../domain/circle';
import { manualDurationMs } from '../../domain/routines';
import { CircleLine } from '../../features/home/CircleLine';
import { CircleWeekRow } from '../../features/home/CircleWeekRow';
import { focusPillLabel, focusPillText, focusSessionText } from '../../features/home/focusPill';
import { ModePicker } from '../../features/home/ModePicker';
import { nextRoutineText } from '../../features/home/nextRoutine';
import { gridSummary, recentDayCells } from '../../features/home/recentDays';
import { blockingLineText, blockingReasonText, type BlockingReach } from '../../features/session/blockingReach';
import { blockingReachOf } from '../../features/session/blockingReachOf';
import { DurationPicker } from '../../features/session/DurationPicker';
import { streakLineText } from '../../features/streak/streakText';
import { useStrings } from '../../i18n';
import { minutesText } from '../../lib/format';
import { useNow } from '../../lib/useNow';

/**
 * Focus — the Brick home. Today's count on top, the last four weeks in the middle, the
 * active mode underneath, the duration, one button. A tap starts; only a deep mode asks
 * for a hold, because it is the one session with no way out (ADR-0022). While a session
 * runs the page says so above the button, and "Seguir" goes back to it; SessionGate
 * normally gets there first.
 */
export default function FocusScreen() {
  const router = useRouter();
  const t = useStrings();
  const now = useNow(15_000);
  const todayMs = useTodayFocusMs(now);
  const streak = useStreak(now);
  const stats = useDayStats();
  const session = useRunningSession();
  const activeMode = useActiveMode();
  const runningModeId = useFocusStore((state) => state.modeId);
  const runningMode = useMode(runningModeId ?? undefined);
  // While a session runs, the page speaks about the mode that is running — a routine
  // may have picked a different one from the default.
  const mode = session !== null && runningMode !== null ? runningMode : activeMode;
  const modes = useModes();
  const schedules = useSchedules();
  const settings = useSettings();
  const setActiveMode = useAppStore((state) => state.setActiveMode);
  const start = useFocusStore((state) => state.start);
  const setIntention = useFocusStore((state) => state.setIntention);
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const hasDemoData = useHasDemoData();
  // The intention of the next session (ADR-0047 §10): written in the duration sheet,
  // handed to the session when it starts, then cleared for the one after.
  const [intention, setIntentionDraft] = useState('');
  // A routine's play in Rutinas sets the mode and the duration and lands here with its
  // id (ADR-0047 §3a): the page says so while the choice is still the routine's.
  const params = useLocalSearchParams<{ routine?: string }>();
  const readyRoutine = schedules.find((schedule) => schedule.id === params.routine) ?? null;
  const routineReady =
    readyRoutine !== null &&
    session === null &&
    mode?.id === readyRoutine.modeId &&
    plannedMs === manualDurationMs(readyRoutine);
  const cells = recentDayCells(stats, now);
  const routineLine = nextRoutineText(schedules, modes, now, t.focus.nextRoutine, {
    starts: settings.routineStarts,
    running: session !== null,
  });
  const openActivity = () => router.push('/(tabs)/activity');

  // A tap floods the page with ink first, like the hold does; the route opens under it.
  const [flooding, setFlooding] = useState(false);
  const begin = () => {
    if (mode === null) {
      setFlooding(false);
      return;
    }
    start(mode.id, plannedMs, Date.now());
    if (intention.trim() !== '') {
      setIntention(intention);
    }
    setIntentionDraft('');
    if (params.routine !== undefined) {
      router.setParams({ routine: undefined });
    }
    router.push('/session/active');
    setFlooding(false);
  };

  const startLabel = plannedMs === null ? t.focus.home.focusOpen : t.focus.home.focusFor(minutesText(plannedMs));
  const deep = mode?.depth === 'deep' && plannedMs !== null;
  // Deep and "sin límite" together run as firm (domain/session.effectiveDepth); the
  // sheet says so once, the page keeps saying it while the choice stands.
  const openRunsFirm = session === null && mode?.depth === 'deep' && plannedMs === null;
  const reach: BlockingReach | null = mode === null ? null : blockingReachOf(mode);
  const cannotBlock = reach === null ? null : blockingReasonText(reach, t.focus.blocking);
  const holdLabel = deep ? t.focus.home.holdFor(minutesText(plannedMs)) : startLabel;
  // With no mode there is nothing to focus with and nothing to time: making the first
  // one is the only way forward, so it is the primary button rather than a dead pill
  // over a ghost halfway up the page (rule 2).
  const footer =
    session !== null ? (
      <Button label={t.focus.home.resume} onPress={() => router.push('/session/active')} />
    ) : mode === null ? (
      <Button label={t.focus.home.createFirstMode} onPress={() => router.push('/modes/edit')} />
    ) : (
      <Stack gap="md">
        <DurationPicker intention={intention} onIntentionChange={setIntentionDraft} />
        {deep ? (
          <HoldButton label={holdLabel} onHold={begin} tapHint={t.focus.home.holdHint} />
        ) : (
          <Button label={startLabel} onPress={() => setFlooding(true)} />
        )}
        <InkFlood active={flooding} onDone={begin} />
      </Stack>
    );

  return (
    <Screen inTabs footer={footer}>
      <Stack align="center" gap="xs">
        <Card onPress={openActivity} accessibilityLabel={focusPillLabel(todayMs, t)}>
          <Text variant="label" weight="medium">
            {focusPillText(todayMs, t)}
          </Text>
        </Card>
        <Text variant="caption" tone="secondary">
          {streakLineText(streak, t)}
        </Text>
        <CircleLine now={now} />
        {/* Seeded history is shown with the user's own until it is removed (ADR-0047 §1). */}
        {hasDemoData ? (
          <Tappable
            onPress={() => router.push('/(tabs)/settings')}
            accessibilityLabel={t.focus.home.demo}
            accessibilityHint={t.focus.home.demoHint}
          >
            <StatusNote align="center" text={t.focus.home.demo} />
          </Tappable>
        ) : null}
      </Stack>

      <Spacer />
      <Stack align="center" gap="xxl">
        <Stack align="center" gap="sm">
          <HeatGrid
            cells={cells}
            columnLabels={t.format.weekdayInitials}
            onPress={openActivity}
            accessibilityLabel={gridSummary(cells, t.focus.recentDays)}
          />
          <CircleWeekRow now={now} todayIndex={weekdayIndex(now)} />
        </Stack>

        <Stack align="center" gap="xs">
          {mode === null ? (
            <>
              <Text variant="heading">{t.focus.home.noModes}</Text>
              <Text variant="label" tone="secondary">
                {t.focus.home.noModesHint}
              </Text>
            </>
          ) : (
            <>
              <ModePicker
                mode={mode}
                modes={modes}
                readOnly={session !== null}
                onSelect={setActiveMode}
                onManage={() => router.push('/modes')}
              />
              {/* What the session will really block, never the example list's count (rule 8).
                  Blocking no apps is a plain fact in the same line (ADR-0047 §1); a phone
                  that cannot block at all says its reason instead, which already reads
                  "Este teléfono no bloquea apps", so the two never stack. */}
              {reach === null ? null : cannotBlock === null ? (
                <Text variant="label" tone="secondary" align="center">
                  {blockingLineText(reach, mode.behavior, t.focus.blocking)}
                </Text>
              ) : (
                <StatusNote align="center" text={cannotBlock} />
              )}
              {openRunsFirm ? <StatusNote align="center" text={t.focus.home.openRunsFirm} /> : null}
              {routineReady && readyRoutine !== null ? (
                <StatusNote align="center" text={t.focus.home.routineReady(readyRoutine.name)} />
              ) : null}
              {routineLine === null ? null : (
                <Text variant="label" tone="secondary">
                  {routineLine}
                </Text>
              )}
              {session === null ? null : (
                <Text variant="label" tone="secondary">
                  {focusSessionText(session, now, t)}
                </Text>
              )}
            </>
          )}
        </Stack>
      </Stack>
      <Spacer />
    </Screen>
  );
}
