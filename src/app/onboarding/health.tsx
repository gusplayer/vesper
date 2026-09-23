import { router } from 'expo-router';
import { useState } from 'react';

import { useAppStore } from '../../data';
import { Button, Text } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { useStrings } from '../../i18n';
import { requestAuthorization, status } from '../../platform/health';

/**
 * Health. Optional: "Not now" moves on without flipping the flag. Where Health does
 * not exist (Android, an iPad, a build without it) the only button moves on and the
 * line under it says why.
 */
export default function HealthScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [busy, setBusy] = useState(false);

  const health = status();
  const copy = t.onboarding.health;
  const blocks: readonly PermissionBlock[] = [
    { icon: 'activity', heading: copy.automatic.heading, body: copy.automatic.body },
    { icon: 'lock', heading: copy.privacy.heading, body: copy.privacy.body },
    { icon: 'heart', heading: copy.verified.heading, body: copy.verified.body },
  ];

  const next = () => router.push('/onboarding/routine');

  const connect = async () => {
    setBusy(true);
    const granted = await requestAuthorization();
    setBusy(false);
    if (granted) {
      updateSettings({ healthConnected: true });
    }
    next();
  };

  return (
    <PermissionPage
      title={copy.title}
      blocks={blocks}
      onBack={() => router.back()}
      footer={
        health.available ? (
          <>
            <Button label={copy.connect} onPress={() => void connect()} busy={busy} busyLabel={copy.connecting} />
            <Button label={copy.notNow} variant="ghost" onPress={next} />
          </>
        ) : (
          <>
            <Button label={copy.continueWithout} onPress={next} />
            <Text variant="caption" tone="secondary" align="center">
              {health.reason}
            </Text>
          </>
        )
      }
    />
  );
}
