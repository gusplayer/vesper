import { router } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useState } from 'react';

import { useAppStore } from '../../data';
import { Button, Text } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { useStrings } from '../../i18n';
import { requestAuthorization, status as blockingStatus } from '../../platform/blocking';
import { isAndroid } from '../../platform/capabilities';

/**
 * Screen Time. "Allow access" asks iOS for real; approval flips
 * `screenTimeConnected`. Where the capability is missing, or when it says no, the
 * onboarding goes on anyway and the caption says why.
 *
 * Android has no system dialog: the same call opens two Settings pages, and Play
 * requires Vesper's own disclosure immediately before the first one (ADR-0046 §2).
 * So there the button leads to `usage-access`, which asks and then lands on the next
 * step, and this screen keeps a plain way past it: the onboarding never demands a
 * permission (ADR-0026).
 */
export default function ScreenTimeScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [reason, setReason] = useState<string | null>(blockingStatus().reason);
  const [busy, setBusy] = useState(false);

  const copy = t.onboarding.screenTime;
  // Android has no Screen Time: naming it there would point at a feature the phone
  // does not have. Only the lines that name it change; the other two are the same
  // ideas on both platforms (ADR-0046).
  const blocks: readonly PermissionBlock[] = [
    {
      icon: 'settings',
      heading: copy.use.heading,
      body: isAndroid ? copy.android.use : copy.use.body,
    },
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
      setReason(blockingStatus().reason ?? (isAndroid ? copy.android.connectFailed : copy.connectFailed));
    }
    router.push('/onboarding/health');
  };

  const disclose = () => {
    router.push({ pathname: '/usage-access', params: { from: 'onboarding' } });
  };

  return (
    <PermissionPage
      title={isAndroid ? copy.android.title : copy.title}
      blocks={blocks}
      onBack={() => goBack(router)}
      footer={
        <>
          <Button
            label={isAndroid ? copy.android.allow : copy.allow}
            busyLabel={copy.asking}
            busy={busy}
            onPress={isAndroid ? disclose : () => void allow()}
          />
          {isAndroid ? (
            <Button variant="ghost" label={copy.notNow} onPress={() => router.push('/onboarding/health')} />
          ) : null}
          <Text variant="caption" tone="secondary" align="center">
            {reason === null
              ? isAndroid
                ? copy.android.systemPrompt
                : copy.systemPrompt
              : copy.continueWithout(reason)}
          </Text>
        </>
      }
    />
  );
}
