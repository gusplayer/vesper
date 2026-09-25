import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../../data';
import type { PermissionFooterProps } from '../../features/onboarding/PermissionFooter';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { stepProgress } from '../../features/onboarding/steps';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { openInstallPage, requestAuthorization, status } from '../../platform/health';

/**
 * Health. Optional: "Ahora no" moves on without flipping the flag. Where Health does
 * not exist (an iPad, a build without it) the only button moves on and the line
 * under it says why. An Android phone without Health Connect (Android 9 to 13) is
 * offered the install from Play, as Ajustes › Salud does (ADR-0043), and the page
 * reads the status again when the user comes back from Play.
 */
export default function HealthScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(() => status());

  // Play installs Health Connect outside the app: read the status again on the way back.
  useFocusEffect(
    useCallback(() => {
      setHealth(status());
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setHealth(status());
      }
    });
    return () => subscription.remove();
  }, []);

  const copy = t.onboarding.health;
  const blocks: readonly PermissionBlock[] = [
    { icon: 'activity', heading: copy.automatic.heading, body: copy.automatic.body },
    { icon: 'lock', heading: copy.privacy.heading, body: copy.privacy.body },
    { icon: 'heart', heading: copy.verified.heading, body: copy.verified.body },
  ];

  const next = () => router.push('/onboarding/apps');
  const skip = { label: copy.notNow, onPress: next };

  const connect = async () => {
    setBusy(true);
    const granted = await requestAuthorization();
    setBusy(false);
    if (granted) {
      updateSettings({ healthConnected: true });
    }
    next();
  };

  const footer: PermissionFooterProps = health.available
    ? { primary: { label: copy.connect, onPress: () => void connect(), busy, busyLabel: copy.connecting }, skip }
    : health.detail?.installable === true
      ? { primary: { label: t.settings.health.install, onPress: () => void openInstallPage() }, skip, note: health.reason }
      : { primary: { label: copy.continueWithout, onPress: next }, note: health.reason };

  return (
    <PermissionPage
      title={copy.title}
      blocks={blocks}
      onBack={() => goBack(router)}
      progress={stepProgress('health', t.onboarding.progress)}
      {...footer}
    />
  );
}
