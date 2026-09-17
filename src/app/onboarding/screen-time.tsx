import { router } from 'expo-router';
import { useState } from 'react';

import { useAppStore } from '../../data';
import { Button, Text } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { useStrings } from '../../i18n';
import { requestAuthorization, status as blockingStatus } from '../../platform/blocking';

/**
 * Screen Time. "Allow access" asks iOS for real; approval flips
 * `screenTimeConnected`. Where the capability is missing, or when it says no, the
 * onboarding goes on anyway and the caption says why.
 */
export default function ScreenTimeScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [reason, setReason] = useState<string | null>(blockingStatus().reason);
  const [busy, setBusy] = useState(false);

  const copy = t.onboarding.screenTime;
  const blocks: readonly PermissionBlock[] = [
    { icon: 'settings', heading: copy.use.heading, body: copy.use.body },
    { icon: 'lock', heading: copy.privacy.heading, body: copy.privacy.body },
    { icon: 'zap', heading: copy.why.heading, body: copy.why.body },
  ];

  const allow = async () => {
    setBusy(true);
    const result = await requestAuthorization();
    setBusy(false);
    if (result === 'approved') {
      updateSettings({ screenTimeConnected: true });
    } else {
      setReason(blockingStatus().reason ?? copy.connectFailed);
    }
    router.push('/onboarding/health');
  };

  return (
    <PermissionPage
      title={copy.title}
      blocks={blocks}
      onBack={() => router.back()}
      footer={
        <>
          <Button label={copy.allow} busyLabel={copy.asking} busy={busy} onPress={() => void allow()} />
          <Text variant="caption" tone="tertiary" align="center">
            {reason === null ? copy.systemPrompt : copy.continueWithout(reason)}
          </Text>
        </>
      }
    />
  );
}
