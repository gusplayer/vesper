import { Redirect, useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';

import { useAppStore, useFocusStore, useRunningSession, useSettings } from '../../data';
import {
  Button,
  HeroObject,
  InkFlood,
  ProgressBar,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import { EMERGENCY_WAIT_MS } from '../../domain/exitRitual';
import { SECOND } from '../../domain/time';
import { EMERGENCY_EXIT_REASON } from '../../features/session/exitReason';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { useBlockBack } from '../../lib/useBlockBack';
import { useNow } from '../../lib/useNow';

/**
 * The emergency unlock, a dark full-screen route over the session (ADR-0025). It
 * says what it costs, waits ten seconds on the same thin bar the breathing uses, and
 * keeps "Seguir enfocando" as the big button. With none left the route says so and
 * only staying remains. Using one runs the paper flood and opens `session/closed`
 * underneath, which names the cost. No back gesture: the two buttons are the ways out.
 *
 * Soft and firm can be left for free through "Terminar", so the page says that before
 * anyone spends one of five. The unlock is spent when the session really closes, not
 * on the tap: if the timer ends during the flood, the session completes and nothing is
 * spent. The flood lives outside the page so it lingers through the fade to `closed`.
 * Opened with no session (a stale link), the route goes to Focus.
 */
export default function EmergencyScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings().session;
  const t = strings.emergency;
  const session = useRunningSession();
  const [arrivedWithSession] = useState(session !== null);
  const left = useSettings().emergencyLeft;
  const spendEmergency = useAppStore((state) => state.useEmergency);
  const finish = useFocusStore((state) => state.finish);
  const [openedAt] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  // The unlock is used at most once, however the flood is retriggered.
  const usedRef = useRef(false);
  const now = useNow(SECOND);

  const use = () => {
    if (usedRef.current) {
      return;
    }
    usedRef.current = true;
    setLeaving(true);
  };
  // The page is paper: close the session under it, pay for it, and swap the route
  // while the paper lingers. A null close means the timer won: nothing to pay.
  const flooded = () => {
    const closed = finish('cancelled', Date.now(), EMERGENCY_EXIT_REASON);
    if (closed !== null) {
      spendEmergency();
      router.replace({ pathname: '/session/closed', params: { emergency: '1' } });
    }
    setLeaving(false);
  };
  const withFlood = (page: ReactNode) => (
    <>
      {page}
      <InkFlood active={leaving} tone="paper" onDone={flooded} />
    </>
  );

  if (session === null) {
    return arrivedWithSession ? withFlood(null) : <Redirect href="/" />;
  }

  const waitLeft = Math.max(0, openedAt + EMERGENCY_WAIT_MS - now);
  const ready = waitLeft === 0;
  // Deep is the one depth with no free way out: the unlock is the point there.
  const freeWay = session.depth === 'deep' ? null : t.freeWay[session.depth];

  return withFlood(
    <Screen
      footer={
        <>
          <Button label={strings.stayFocused} onPress={() => goBack(router)} />
          {left > 0 ? <Button variant="ghost" label={t.use} onPress={use} disabled={!ready} /> : null}
        </>
      }
    >
      <Spacer />
      <Stack align="center" gap="xl">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {t.title}
          </Text>
          <Text tone="secondary" align="center">
            {left === 0 ? t.none : t.body(left)}
          </Text>
          {/* With none left the free way is the only one, so it matters most then. */}
          {freeWay === null ? null : (
            <Text variant="label" tone="secondary" align="center">
              {freeWay}
            </Text>
          )}
        </Stack>
      </Stack>
      <Spacer />
      {/* The wait sits outside the centered stack so the bar spans the page, like the breathing's. */}
      {left === 0 ? (
        <Text variant="caption" tone="secondary" align="center">
          {t.noneHint}
        </Text>
      ) : (
        <Stack gap="sm">
          {/* Announced once, when the wait is over: not each second of it. */}
          <Text variant="caption" tone="secondary" align="center" live={ready}>
            {ready ? t.ready : t.wait(Math.ceil(waitLeft / SECOND))}
          </Text>
          <ProgressBar progress={1 - waitLeft / EMERGENCY_WAIT_MS} accessibilityLabel={t.waitLabel} />
        </Stack>
      )}
    </Screen>,
  );
}
