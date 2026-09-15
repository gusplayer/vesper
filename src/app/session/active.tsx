import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  Button,
  FieldRow,
  FlipClock,
  HeroObject,
  ProgressBar,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import { useAppStore, useFocusStore, useMode, useRunningSession, useSettings } from '../../data';
import { countText, modeRunningText } from '../../data/modes';
import { elapsed, isDue, remaining, sessionProgress } from '../../domain/session';
import { EmergencySheet } from '../../features/session/EmergencySheet';
import { timerText } from '../../lib/format';
import { useNow } from '../../lib/useNow';

/**
 * The running session. The store already flipped the theme to dark. The clock is
 * `now - startedAt`, never accumulated ticks, so it survives the background. How the
 * session ends depends on the depth chosen on the mode (domain/session).
 */
export default function ActiveSessionScreen() {
  const router = useRouter();
  const session = useRunningSession();
  const modeId = useFocusStore((state) => state.modeId);
  const mode = useMode(modeId ?? undefined);
  const emergencyLeft = useSettings().emergencyLeft;
  const finish = useFocusStore((state) => state.finish);
  const setIntention = useFocusStore((state) => state.setIntention);
  const registerInterruption = useFocusStore((state) => state.registerInterruption);
  const spendEmergency = useAppStore((state) => state.useEmergency);
  const now = useNow(1000);
  const [intention, setIntentionText] = useState(session?.intention ?? '');
  const [askingEmergency, setAskingEmergency] = useState(false);
  // The session closes exactly once, whichever path gets there first.
  const closedRef = useRef(false);

  // Leaving the app is an interruption in firm and deep; the domain ignores soft.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        registerInterruption();
      }
    });
    return () => subscription.remove();
  }, [registerInterruption]);

  // The timer ran out: the session completes on its own.
  const due = session !== null && isDue(session, now);
  useEffect(() => {
    if (due && !closedRef.current) {
      closedRef.current = true;
      finish('completed', Date.now());
      router.replace('/session/complete');
    }
  }, [due, finish, router]);

  if (session === null) {
    return null;
  }

  const leave = (reason: string | null) => {
    if (closedRef.current) {
      return;
    }
    closedRef.current = true;
    setAskingEmergency(false);
    finish('cancelled', Date.now(), reason);
    router.dismissTo('/(tabs)');
  };

  const onIntention = (text: string) => {
    setIntentionText(text);
    setIntention(text);
  };

  const endButton =
    session.depth === 'deep' ? (
      <Button label="Profundo · solo el timer termina" onPress={() => undefined} disabled />
    ) : (
      <Button label="Terminar" onPress={() => router.push('/session/exit')} />
    );

  const footer = (
    <>
      {endButton}
      <Button
        variant="ghost"
        label={
          emergencyLeft > 0
            ? `Desbloqueo de emergencia (${emergencyLeft})`
            : 'Sin desbloqueos de emergencia'
        }
        disabled={emergencyLeft === 0}
        onPress={() => setAskingEmergency(true)}
      />
    </>
  );

  return (
    <Screen footer={footer}>
      <Stack align="center" gap="xs">
        <Text variant="label" tone="secondary">
          Llevas enfocado
        </Text>
        <FlipClock value={timerText(elapsed(session, now))} />
      </Stack>

      <Spacer />
      <Stack align="center">
        <HeroObject />
      </Stack>
      <Spacer />

      <Stack align="center" gap="xs">
        <Text variant="heading">{mode?.name ?? 'Sesión'}</Text>
        {mode === null ? null : (
          <Text variant="label" tone="secondary">
            {modeRunningText(mode)}
          </Text>
        )}
        <Button variant="ghost" label="Ver modos ›" onPress={() => router.push('/modes')} />
      </Stack>

      <FieldRow
        label="Intención"
        value={intention}
        onChangeText={onIntention}
        placeholder="¿Qué vas a hacer?"
      />

      <Stack gap="sm">
        <ProgressBar progress={sessionProgress(session, now)} />
        <Stack direction="row" justify="space-between">
          <Text variant="caption" tone="secondary">
            {`quedan ${timerText(remaining(session, now))}`}
          </Text>
          {session.interruptions > 0 ? (
            <Text variant="caption" tone="secondary">
              {countText(session.interruptions, 'interrupción', 'interrupciones')}
            </Text>
          ) : null}
        </Stack>
      </Stack>

      {askingEmergency ? (
        <EmergencySheet
          left={emergencyLeft}
          onStay={() => setAskingEmergency(false)}
          onUse={() => {
            spendEmergency();
            leave('desbloqueo de emergencia');
          }}
        />
      ) : null}
    </Screen>
  );
}
