import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  Banner,
  Button,
  Card,
  HeatGrid,
  HoldButton,
  InkFlood,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import {
  useActiveMode,
  useAppStore,
  useDayStats,
  useFocusStore,
  useMode,
  useModes,
  useRunningSession,
  useSchedules,
  useSettings,
  useStreak,
  useTodayFocusMs,
} from '../../data';
import { modeSummaryText, usePlannedStore } from '../../data/modes';
import { focusPillLabel, focusPillText, focusSessionText } from '../../features/home/focusPill';
import { ModePicker } from '../../features/home/ModePicker';
import { nextRoutineText } from '../../features/home/nextRoutine';
import { gridSummary, recentDayCells } from '../../features/home/recentDays';
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
  const dismissBanner = useAppStore((state) => state.dismissBanner);
  const setActiveMode = useAppStore((state) => state.setActiveMode);
  const start = useFocusStore((state) => state.start);
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const cells = recentDayCells(stats, now);
  const routineLine = nextRoutineText(schedules, modes, now, t.focus.nextRoutine, {
    lastMark: settings.lastRoutineStart,
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
    router.push('/session/active');
    setFlooding(false);
  };

  const startLabel = plannedMs === null ? t.focus.home.focusOpen : t.focus.home.focusFor(minutesText(plannedMs));
  const deep = mode?.depth === 'deep' && plannedMs !== null;
  const holdLabel = deep ? t.focus.home.holdFor(minutesText(plannedMs)) : startLabel;
  const footer =
    session !== null ? (
      <Button label={t.focus.home.resume} onPress={() => router.push('/session/active')} />
    ) : (
      <Stack gap="md">
        <DurationPicker />
        {deep ? (
          <HoldButton label={holdLabel} onHold={begin} />
        ) : (
          <Button label={startLabel} onPress={() => setFlooding(true)} disabled={mode === null} />
        )}
        <InkFlood active={flooding} onDone={begin} />
      </Stack>
    );

  return (
    <Screen inTabs footer={footer}>
      {settings.pendingBanner === null ? null : (
        <Banner
          title={settings.pendingBanner.title}
          message={settings.pendingBanner.message}
          onDismiss={dismissBanner}
        />
      )}

      <Stack align="center" gap="xs">
        <Card onPress={openActivity} accessibilityLabel={focusPillLabel(todayMs, t)}>
          <Text variant="label" weight="medium">
            {focusPillText(todayMs, t)}
          </Text>
        </Card>
        <Text variant="caption" tone="secondary">
          {streakLineText(streak, t)}
        </Text>
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
        </Stack>

        <Stack align="center" gap="xs">
          {mode === null ? (
            <>
              <Text variant="heading">{t.focus.home.noModes}</Text>
              <Text variant="label" tone="secondary">
                {t.focus.home.noModesHint}
              </Text>
              <Button
                variant="ghost"
                label={t.focus.home.createFirstMode}
                onPress={() => router.push('/modes/edit')}
              />
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
              <Text variant="label" tone="secondary">
                {modeSummaryText(mode, t.modes)}
              </Text>
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
