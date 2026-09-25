import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAppStore, useSettings } from '../../data';
import {
  Button,
  ExplainerBlock,
  PageHeader,
  Screen,
  Stack,
  StatusNote,
  type IconName,
} from '../../design/components';
import { HealthWeekSummary } from '../../features/health/HealthWeekSummary';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';
import { openHealthApp, openInstallPage, requestAuthorization, status } from '../../platform/health';
import { syncHealth } from '../../platform/hooks/useHealthSync';

/** The week summary only needs to notice a new day; coming back from Play re-renders too. */
const CLOCK_MS = 60_000;

/** Three blocks, like the onboarding's Health page: what it does, what it keeps, why. */
const BLOCK_KEYS: readonly { key: 'how' | 'privacy' | 'why'; icon: IconName }[] = [
  { key: 'how', icon: 'activity' },
  { key: 'privacy', icon: 'lock' },
  { key: 'why', icon: 'heart' },
];

/**
 * Salud: the pitch and a connect button, or the week's summary and a way out.
 * Connecting asks HealthKit or Health Connect for real; when Health is not available
 * here the button is disabled and the line under it says why. On Android 9 to 13
 * without Health Connect the button installs it from Play instead (ADR-0043), and
 * once connected the page points into Health Connect, where the user links sources.
 *
 * Connected is a setting, not a guarantee: Health Connect can be uninstalled after
 * the fact. Then the summary stays, the reason is said under it, and the install
 * button comes back where Play can bring Health Connect again.
 */
export default function HealthScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setHealthMarks = useAppStore((state) => state.setHealthMarks);
  const t = useStrings();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  const now = useNow(CLOCK_MS);

  const health = status();
  const connected = settings.healthConnected;
  const installable = health.detail?.installable === true;

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

  const install = () => {
    setInstallFailed(!openInstallPage());
  };

  /**
   * Disconnecting removes every mark Health made, and verified habits fall back to
   * declared (ADR-0041); the permission itself stays in Health. Both are said before
   * anything is deleted.
   */
  const disconnect = () => {
    Alert.alert(t.settings.health.disconnectTitle, t.settings.health.disconnectMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.health.disconnect,
        style: 'destructive',
        onPress: () => {
          setHealthMarks([], Date.now());
          updateSettings({ healthConnected: false, healthSyncedAt: null });
        },
      },
    ]);
  };

  const installButton = <Button label={t.settings.health.install} onPress={install} />;
  const installFailedLine = installFailed ? <StatusNote text={t.settings.health.installFailed} align="center" live /> : null;

  const caption = health.reason ?? (denied ? t.settings.health.denied : null);

  return (
    <Screen
      scroll
      footer={
        connected ? (
          <>
            {installable ? installButton : null}
            {installFailedLine}
            <Button label={t.settings.health.disconnect} variant="ghost" tone="danger" onPress={disconnect} />
          </>
        ) : (
          <>
            {installable ? (
              installButton
            ) : (
              <Button
                label={t.settings.health.connect}
                onPress={() => void connect()}
                disabled={!health.available}
                busy={busy}
                busyLabel={t.settings.health.connecting}
              />
            )}
            {caption === null ? null : <StatusNote text={caption} align="center" live={denied} />}
            {installFailedLine}
          </>
        )
      }
    >
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.health.title} />

      {connected ? (
        <>
          <Stack gap="sm">
            <HealthWeekSummary now={now} onSyncNow={() => syncHealth(true)} />
            {health.reason === null ? null : <StatusNote text={health.reason} icon="info" />}
          </Stack>
          <StatusNote text={t.settings.health.syncNote} align="center" />
          {health.detail?.healthConnect === true ? (
            <>
              <StatusNote text={t.settings.health.healthConnectNote} align="center" />
              <Button label={t.settings.health.openHealthConnect} variant="ghost" onPress={() => void openHealthApp()} />
            </>
          ) : health.available ? (
            // iOS: HealthKit never says whether reading was allowed, so an empty week
            // is what a refusal looks like. Say where to look.
            <StatusNote text={t.settings.health.iosEmptyHint} align="center" />
          ) : null}
        </>
      ) : (
        <Stack gap="xxl">
          {BLOCK_KEYS.map(({ key, icon }) => (
            <ExplainerBlock
              key={key}
              icon={icon}
              heading={t.settings.health.blocks[key].title}
              body={t.settings.health.blocks[key].text}
            />
          ))}
        </Stack>
      )}
    </Screen>
  );
}
