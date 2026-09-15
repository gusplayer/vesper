import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  Banner,
  Button,
  Card,
  HeatGrid,
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
  useRunningSession,
  useSettings,
  useTodayFocusMs,
} from '../../data';
import { modeSummaryText, usePlannedStore } from '../../data/modes';
import { WEEKDAY_INITIALS, recentDayCells } from '../../features/home/recentDays';
import { DurationSheet } from '../../features/session/DurationSheet';
import { durationText } from '../../lib/format';
import { useNow } from '../../lib/useNow';

/**
 * Foco — the Brick home. Today's count on top, the object in the middle, the active
 * mode underneath, one button. A tap asks how long; a hold reuses the last answer.
 */
export default function FocusScreen() {
  const router = useRouter();
  const now = useNow(15_000);
  const todayMs = useTodayFocusMs(now);
  const stats = useDayStats();
  const mode = useActiveMode();
  const session = useRunningSession();
  const settings = useSettings();
  const dismissBanner = useAppStore((state) => state.dismissBanner);
  const start = useFocusStore((state) => state.start);
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const [asking, setAsking] = useState(false);

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
      <Button label="Seguir" onPress={() => router.push('/session/active')} />
    ) : (
      <Button
        label="Toca o mantén para enfocar"
        onPress={() => setAsking(true)}
        onLongPress={() => begin(plannedMs)}
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
        <Card>
          <Text variant="label" weight="medium">
            {`${durationText(todayMs)} enfocado hoy`}
          </Text>
        </Card>
      </Stack>

      <Spacer />
      <Stack align="center" gap="sm">
        <HeatGrid
          cells={recentDayCells(stats, now)}
          columnLabels={WEEKDAY_INITIALS}
          onPress={() => router.push('/(tabs)/activity')}
          accessibilityLabel="Últimas cuatro semanas de foco. Toca para ver la actividad"
        />
        <Text variant="caption" tone="tertiary">
          Últimas cuatro semanas
        </Text>
      </Stack>
      <Spacer />

      <Stack align="center" gap="xs">
        {mode === null ? (
          <>
            <Text variant="heading">Sin modos</Text>
            <Text variant="label" tone="secondary">
              Un modo dice qué se bloquea mientras enfocás
            </Text>
            <Button
              variant="ghost"
              label="Crea tu primer modo ›"
              onPress={() => router.push('/modes/edit')}
            />
          </>
        ) : (
          <>
            <Text variant="heading">{mode.name}</Text>
            <Text variant="label" tone="secondary">
              {modeSummaryText(mode)}
            </Text>
            <Button variant="ghost" label="Gestionar modos ›" onPress={() => router.push('/modes')} />
          </>
        )}
      </Stack>

      <DurationSheet visible={asking} onClose={() => setAsking(false)} onStart={begin} />
    </Screen>
  );
}
