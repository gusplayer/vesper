import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAppStore, useSettings } from '../../data';
import {
  Button,
  Icon,
  PageHeader,
  Screen,
  Stack,
  Text,
  type IconName,
} from '../../design/components';
import { HealthWeekSummary } from '../../features/health/HealthWeekSummary';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { requestAuthorization, status } from '../../platform/health';
import { syncHealth } from '../../platform/hooks/useHealthSync';

/** The week summary only needs to notice a new day. */
const CLOCK_MS = 60_000;

/** Three blocks, like Brick's Screen Time page: what it does, what it keeps, why. */
const BLOCK_KEYS: readonly { key: 'how' | 'privacy' | 'why'; icon: IconName }[] = [
  { key: 'how', icon: 'activity' },
  { key: 'privacy', icon: 'lock' },
  { key: 'why', icon: 'heart' },
];

/**
 * Salud: the pitch and a connect button, or the week's summary and a way out.
 * Connecting asks HealthKit for real; when Health is not available here the button
 * is disabled and the line under it says why.
 */
export default function HealthScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setHealthMarks = useAppStore((state) => state.setHealthMarks);
  const t = useStrings();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const now = useNow(CLOCK_MS);

  const health = status();
  const connected = settings.healthConnected;

  const connect = async () => {
    setBusy(true);
    setDenied(false);
    const granted = await requestAuthorization();
    setBusy(false);
    if (!granted) {
      setDenied(true);
      return;
    }
    updateSettings({ healthConnected: true });
    void syncHealth(true);
  };

  const disconnect = () => {
    setHealthMarks([], Date.now());
    updateSettings({ healthConnected: false, healthSyncedAt: null });
  };

  const caption = health.reason ?? (denied ? t.settings.health.denied : null);

  return (
    <Screen
      scroll
      footer={
        connected ? undefined : (
          <>
            <Button
              label={t.settings.health.connect}
              onPress={() => void connect()}
              disabled={!health.available}
              busy={busy}
              busyLabel={t.settings.health.connecting}
            />
            {caption === null ? null : (
              <Text variant="caption" tone="tertiary" align="center">
                {caption}
              </Text>
            )}
          </>
        )
      }
    >
      <PageHeader onBack={() => router.back()} title={t.settings.health.title} />

      {connected ? (
        <>
          <HealthWeekSummary now={now} onSyncNow={() => void syncHealth(true)} />
          <Text variant="caption" tone="tertiary" align="center">
            {t.settings.health.syncNote}
          </Text>
          <Button label={t.settings.health.disconnect} variant="ghost" onPress={disconnect} />
        </>
      ) : (
        <Stack gap="xxl">
          {BLOCK_KEYS.map(({ key, icon }) => (
            <Stack key={key} direction="row" align="flex-start" gap="lg">
              <Icon name={icon} size="lg" />
              <Stack grow gap="xs">
                <Text variant="heading">{t.settings.health.blocks[key].title}</Text>
                <Text variant="label" tone="secondary">
                  {t.settings.health.blocks[key].text}
                </Text>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Screen>
  );
}
