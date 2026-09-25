import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppStore } from '../../data';
import type { PermissionFooterProps } from '../../features/onboarding/PermissionFooter';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { stepProgress } from '../../features/onboarding/steps';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { isAuthorized, requestAuthorization, status as blockingStatus } from '../../platform/blocking';
import { isAndroid } from '../../platform/capabilities';

const NEXT = '/onboarding/health';

/**
 * Screen Time. It comes before the apps step (ADR-0016): the real picker there only
 * has something to show once the phone said yes.
 *
 * "Permitir acceso" asks iOS for real; approval flips `screenTimeConnected`. A no, or
 * a phone where Screen Time cannot exist (simulator, no entitlement), stays on this
 * page and says why, and the primary becomes "Continuar sin Tiempo de uso": there is
 * no dialog left to promise. "Ahora no" is there whenever something can be asked —
 * the onboarding never demands a permission (ADR-0026 §3).
 *
 * Android has no system dialog: the same call opens two Settings pages, and Play
 * requires Vesper's own disclosure immediately before the first one (ADR-0046 §2).
 * There the button leads to `usage-access`, which asks and then lands on the next
 * step. The status is read again whenever this page comes back into view, because
 * the answer is given in Settings, not here.
 */
export default function ScreenTimeScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [blocking, setBlocking] = useState(() => blockingStatus());
  const [authorized, setAuthorized] = useState(() => isAuthorized());
  const [busy, setBusy] = useState(false);
  /** Why iOS said no, on this page rather than on the way out. */
  const [failure, setFailure] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setBlocking(blockingStatus());
      setAuthorized(isAuthorized());
    }, []),
  );

  const copy = t.onboarding.screenTime;
  // Android has no Screen Time: naming it there would point at a feature the phone
  // does not have. Only the lines that name it change; the other two are the same
  // ideas on both platforms (ADR-0046).
  const blocks: readonly PermissionBlock[] = [
    { icon: 'settings', heading: copy.use.heading, body: isAndroid ? copy.android.use : copy.use.body },
    { icon: 'lock', heading: copy.privacy.heading, body: copy.privacy.body },
    { icon: 'zap', heading: copy.why.heading, body: copy.why.body },
  ];

  const next = () => router.push(NEXT);
  const skip = { label: copy.notNow, onPress: next };

  const allow = async () => {
    setBusy(true);
    const result = await requestAuthorization();
    setBusy(false);
    if (result === 'approved') {
      updateSettings({ screenTimeConnected: true });
      setAuthorized(true);
      next();
      return;
    }
    const now = blockingStatus();
    setBlocking(now);
    setFailure(now.reason ?? copy.connectFailed);
  };

  const footer = ((): PermissionFooterProps => {
    if (isAndroid) {
      if (blocking.available) {
        return { primary: { label: t.common.continue, onPress: next }, note: copy.android.granted };
      }
      // Only the two Settings toggles can be granted from here; a build without the
      // module is a fact, and the disclosure would lead nowhere.
      if (blocking.detail?.missing !== undefined) {
        return {
          primary: {
            label: copy.android.allow,
            onPress: () => router.push({ pathname: '/usage-access', params: { from: 'onboarding' } }),
          },
          skip,
          note: copy.android.systemPrompt,
        };
      }
      return {
        primary: { label: copy.android.continueWithoutLabel, onPress: next },
        note: copy.continueWithout(blocking.reason ?? copy.android.connectFailed),
      };
    }
    const reason = failure ?? blocking.reason;
    if (reason !== null) {
      return { primary: { label: copy.continueWithoutLabel, onPress: next }, note: copy.continueWithout(reason) };
    }
    if (authorized) {
      return { primary: { label: t.common.continue, onPress: next }, note: copy.granted };
    }
    return {
      primary: { label: copy.allow, onPress: () => void allow(), busy, busyLabel: copy.asking },
      skip,
      note: copy.systemPrompt,
    };
  })();

  return (
    <PermissionPage
      title={isAndroid ? copy.android.title : copy.title}
      blocks={blocks}
      onBack={() => goBack(router)}
      progress={stepProgress('screen-time', t.onboarding.progress)}
      {...footer}
    />
  );
}
