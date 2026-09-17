import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

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
import { useStrings } from '../../i18n';
import { useBlockBack } from '../../lib/useBlockBack';
import { useNow } from '../../lib/useNow';

/**
 * The emergency unlock, a dark full-screen route over the session (ADR-0025). It
 * says what it costs, waits ten seconds on the same thin bar the breathing uses, and
 * keeps "Seguir enfocado" as the big button. With none left the route says so and
 * only staying remains. Using one runs the paper flood and opens `session/closed`
 * underneath, which names the cost. No back gesture: the two buttons are the ways out.
 */
export default function EmergencyScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings().session;
  const t = strings.emergency;
  const session = useRunningSession();
  const left = useSettings().emergencyLeft;
  const spendEmergency = useAppStore((state) => state.useEmergency);
  const finish = useFocusStore((state) => state.finish);
  const [openedAt] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  // The unlock is spent at most once, however the flood is retriggered.
  const usedRef = useRef(false);
  const now = useNow(SECOND);

  if (session === null) {
    return null;
  }

  const waitLeft = Math.max(0, openedAt + EMERGENCY_WAIT_MS - now);
  const ready = waitLeft === 0;

  const use = () => {
    if (usedRef.current) {
      return;
    }
    usedRef.current = true;
    spendEmergency();
    setLeaving(true);
  };
  // The page is paper: close the session under it and swap the route while it lingers.
  const flooded = () => {
    finish('cancelled', Date.now(), t.reason);
    router.replace({ pathname: '/session/closed', params: { emergency: '1' } });
    setLeaving(false);
  };

  return (
    <Screen
      footer={
        <>
          <Button label={strings.stayFocused} onPress={() => router.back()} />
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
          <Text variant="caption" tone="secondary" align="center">
            {ready ? t.ready : t.wait(Math.ceil(waitLeft / SECOND))}
          </Text>
          <ProgressBar progress={1 - waitLeft / EMERGENCY_WAIT_MS} />
        </Stack>
      )}
      <InkFlood active={leaving} tone="paper" onDone={flooded} />
    </Screen>
  );
}
