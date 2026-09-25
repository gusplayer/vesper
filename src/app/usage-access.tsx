import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { goBack } from '../lib/goBack';
import { useState } from 'react';

import { useAppStore } from '../data';
import { PermissionPage, type PermissionBlock } from '../features/onboarding/PermissionPage';
import { stepProgress } from '../features/onboarding/steps';
import { useStrings } from '../i18n';
import { requestAuthorization, status as blockingStatus } from '../platform/blocking';
import { isAndroid } from '../platform/capabilities';

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
 * and that Vesper keeps no usage history of its own. And it announces the second
 * Settings page, display over other apps, which Android opens right after the first
 * (PLAY_DECLARATIONS.md b, `SYSTEM_ALERT_WINDOW`): nothing arrives unannounced.
 *
 * Android only. On iOS there is no usage-access page — the selection is an opaque
 * Screen Time token (ADR-0004) — so a link that lands here there goes home.
 *
 * It never demands. The back arrow goes back; from the onboarding (`from=onboarding`)
 * the ghost says "Ahora no" and skips to the next step, like the step before it, so the
 * user is not returned to a question they already answered (ADR-0026).
 */
export default function UsageAccessScreen() {
  const t = useStrings();
  const copy = t.modes.usageAccess;
  const { from } = useLocalSearchParams<{ from?: string }>();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fromOnboarding = from === 'onboarding';

  if (!isAndroid) {
    return <Redirect href="/" />;
  }

  const blocks: readonly PermissionBlock[] = [
    { icon: 'shield', heading: copy.session.heading, body: copy.session.body },
    { icon: 'bar-chart-2', heading: copy.activity.heading, body: copy.activity.body },
    { icon: 'lock', heading: copy.privacy.heading, body: copy.privacy.body },
    { icon: 'layers', heading: copy.overlay.heading, body: copy.overlay.disclosure },
  ];

  // This route can be the first one in the stack — a deep link, or a cold launch that
  // restored it — and then there is nothing to go back to: goBack falls back to Focus.
  const back = () => goBack(router);

  // Past this step: the onboarding goes on to Health (the Screen Time step is
  // answered, so it is replaced, not stacked on); anywhere else, back where it came from.
  const onward = () => {
    if (fromOnboarding) {
      router.replace('/onboarding/health');
      return;
    }
    back();
  };

  const allow = async () => {
    setBusy(true);
    const result = await requestAuthorization();
    setBusy(false);
    if (result === 'approved') {
      updateSettings({ screenTimeConnected: true });
      onward();
      return;
    }
    // Nothing was granted: say why in a line and leave the button where it is, so a
    // second try is one tap away and going back is still the other option.
    const reason = blockingStatus().reason;
    setFailure(reason === null ? copy.failedUnknown : copy.failed(reason));
  };

  return (
    <PermissionPage
      title={copy.title}
      blocks={blocks}
      onBack={back}
      progress={fromOnboarding ? stepProgress('screen-time', t.onboarding.progress) : undefined}
      primary={{ label: copy.continueLabel, onPress: () => void allow(), busy, busyLabel: copy.opening }}
      skip={{ label: fromOnboarding ? copy.notNow : t.common.back, onPress: onward }}
      note={failure ?? copy.systemPrompt}
    />
  );
}
