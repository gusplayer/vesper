import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  Banner,
  Button,
  Card,
  HeatGrid,
  HoldButton,
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
  useTodayFocusMs,
  useWeekProgress,
} from '../../data';
import { modeSummaryText, usePlannedStore } from '../../data/modes';
import { focusPillLabel, focusPillText } from '../../features/home/focusPill';
import { ModePicker } from '../../features/home/ModePicker';
import { nextRoutineText } from '../../features/home/nextRoutine';
import { gridSummary, recentDayCells } from '../../features/home/recentDays';
import { DurationSheet } from '../../features/session/DurationSheet';
import { useStrings } from '../../i18n';
import { minutesText } from '../../lib/format';
import { useNow } from '../../lib/useNow';

/**
 * Focus — the Brick home. Today's count on top, the object in the middle, the active
 * mode underneath, one button. A tap asks how long; a hold reuses the last answer.
 */
export default function FocusScreen() {
  const router = useRouter();
  const t = useStrings();
  const now = useNow(15_000);
  const todayMs = useTodayFocusMs(now);
  const week = useWeekProgress(now);
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
  const [asking, setAsking] = useState(false);
  const cells = recentDayCells(stats, now);
  const routineLine = nextRoutineText(schedules, modes, now, t.focus.nextRoutine);
  const openActivity = () => router.push('/(tabs)/activity');

  const begin = (ms: number) => {
    if (mode === null) {
      return;
    }
    setAsking(false);
    start(mode.id, ms, Date.now());
    router.push('/session/active');
  };

  const footer =
    session !== null ? (
      <Button label={t.focus.home.resume} onPress={() => router.push('/session/active')} />
    ) : (
      <HoldButton
        label={t.focus.home.holdToFocus}
        hint={t.focus.home.holdHint(minutesText(plannedMs))}
        onHold={() => begin(plannedMs)}
        onPress={() => setAsking(true)}
        disabled={mode === null}
      />
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

      <Stack align="center">
        <Card onPress={openActivity} accessibilityLabel={focusPillLabel(todayMs, week, t)}>
          <Text variant="label" weight="medium">
            {focusPillText(todayMs, week, t)}
          </Text>
        </Card>
      </Stack>

      <Spacer />
      <Stack align="center" gap="xxl">
        <Stack align="center" gap="sm">
          <HeatGrid
            cells={cells}
            columnLabels={t.focus.recentDays.weekdayInitials}
            onPress={openActivity}
            accessibilityLabel={gridSummary(cells, t.focus.recentDays)}
          />
          <Button variant="ghost" label={t.focus.home.seeActivity} onPress={openActivity} />
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
            </>
          )}
        </Stack>
      </Stack>
      <Spacer />

      <DurationSheet visible={asking} onClose={() => setAsking(false)} onStart={begin} />
    </Screen>
  );
}
