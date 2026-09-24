import { router, useLocalSearchParams } from 'expo-router';

import { goBack } from '../lib/goBack';
import { useState } from 'react';

import { useAppStore } from '../data';
import { Button, Text } from '../design/components';
import { PermissionPage, type PermissionBlock } from '../features/onboarding/PermissionPage';
import { useStrings } from '../i18n';
import { requestAuthorization, status as blockingStatus } from '../platform/blocking';

/**
 * The prominent disclosure Google Play requires for `PACKAGE_USAGE_STATS`
 * (ADR-0046 §2, docs/PLAY_DECLARATIONS.md b): a screen of its own, immediately before
 * the system's usage-access page, never an alert and never a paragraph buried in a
 * longer step.
 *
 * It says the two purposes separately, because the build has two: during a session
 * Vesper reads which app is in front so the shield can rise, and in the Activity tab,
 * with no session running, it asks the system how long each chosen app was in front
 * today and this week (ADR-0029). It also says that neither answer leaves the phone
 * and that Vesper keeps no usage history of its own.
 *
 * Android only. On iOS there is no usage-access page — the selection is an opaque
 * Screen Time token (ADR-0004) — so nothing pushes this route there.
 *
 * It never demands. "Volver" goes back and the whole app keeps working; the
 * onboarding step that leads here can be skipped outright (ADR-0026). `from=onboarding`
 * only says where to land after the answer, so the user is not returned to a step
 * they already answered.
 */
export default function UsageAccessScreen() {
  const t = useStrings();
  const copy = t.modes.usageAccess;
  const { from } = useLocalSearchParams<{ from?: string }>();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const blocks: readonly PermissionBlock[] = [
    { icon: 'shield', heading: copy.session.heading, body: copy.session.body },
    { icon: 'bar-chart-2', heading: copy.activity.heading, body: copy.activity.body },
    { icon: 'lock', heading: copy.privacy.heading, body: copy.privacy.body },
  ];

  const leave = () => {
    if (from === 'onboarding') {
      // The Screen Time step is answered: replace it in the stack, do not stack on it.
      router.replace('/onboarding/health');
      return;
    }
    // This route can be the first one in the stack — a deep link, or a cold launch
    // that restored it — and then there is nothing to go back to. Without the guard
    // the navigator shows the user its own error. Focus is the honest fallback.
    if (router.canGoBack()) {
      goBack(router);
      return;
    }
    router.replace('/');
  };

  const allow = async () => {
    setBusy(true);
    const result = await requestAuthorization();
    setBusy(false);
    if (result === 'approved') {
      updateSettings({ screenTimeConnected: true });
      leave();
      return;
    }
    // Nothing was granted: say why in a line and leave the button where it is, so a
    // second try is one tap away and going back is still the other option.
    setReason(blockingStatus().reason ?? copy.failed);
  };

  return (
    <PermissionPage
      title={copy.title}
      blocks={blocks}
      onBack={leave}
      footer={
        <>
          <Button label={copy.continueLabel} busyLabel={copy.opening} busy={busy} onPress={() => void allow()} />
          <Button variant="ghost" label={t.common.back} onPress={leave} />
          <Text variant="caption" tone="secondary" align="center">
            {reason === null ? copy.systemPrompt : reason}
          </Text>
        </>
      }
    />
  );
}
