import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { FocusArt } from '../../features/session/FocusArt';
import { timerText } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { useOrientation } from '../../lib/useOrientation';
import { allowRotation, lockPortrait } from '../../platform/orientation';

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
  const orientation = useOrientation();

  // Only this screen may turn sideways; everything else is portrait.
  useFocusEffect(
    useCallback(() => {
      allowRotation();
      return () => lockPortrait();
    }, []),
  );
  const [intention, setIntentionText] = useState(session?.intention ?? '');
  const [askingEmergency, setAskingEmergency] = useState(false);
  // The drawing view (ADR-0018). A view, not a state: exit rules do not change.
  // `?art=1` opens it directly, for links and for reviewing.
  const params = useLocalSearchParams<{ art?: string }>();
  const [showingArt, setShowingArt] = useState(params.art === '1');
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

  // Sideways, the session is a clock on a table: the time, the mode, the bar. No buttons;
  // turning the phone back is the way to act.
  if (orientation === 'landscape') {
    if (showingArt) {
      // Sideways with the drawing: the clock keeps the left third, the work the rest.
      return (
        <Screen>
          <Stack direction="row" gap="xl" grow align="stretch">
            <Stack justify="center" align="center" gap="sm">
              <FlipClock value={timerText(elapsed(session, now))} scale={0.8} />
              <Text variant="caption" tone="secondary" align="center">
                {mode === null ? 'Enfocado' : mode.name}
              </Text>
              <Text variant="caption" tone="tertiary" align="center">
                {`quedan ${timerText(remaining(session, now))}`}
              </Text>
            </Stack>
            <FocusArt session={session} now={now} onPress={() => setShowingArt(false)} layout="landscape" />
          </Stack>
          <ProgressBar progress={sessionProgress(session, now)} />
        </Screen>
      );
    }
    return (
      <Screen>
        <Spacer />
        <Stack align="center" gap="lg">
          <FlipClock value={timerText(elapsed(session, now))} scale={1.6} />
          <Text variant="label" tone="secondary">
            {mode === null ? 'Enfocado' : `${mode.name} · quedan ${timerText(remaining(session, now))}`}
          </Text>
          <Button variant="ghost" label="Arte" onPress={() => setShowingArt(true)} />
        </Stack>
        <Spacer />
        <ProgressBar progress={sessionProgress(session, now)} />
      </Screen>
    );
  }

  // With the drawing open the clock shrinks and the middle of the page is the work;
  // the intention and the mode step aside, the exit stays where it always is.
  if (showingArt) {
    return (
      <Screen footer={footer}>
        <Stack align="center" gap="xs">
          <FlipClock value={timerText(elapsed(session, now))} scale={0.7} />
        </Stack>
        <Spacer />
        <FocusArt session={session} now={now} onPress={() => setShowingArt(false)} />
        <Spacer />
        <ProgressBar progress={sessionProgress(session, now)} />
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

  return (
    <Screen footer={footer}>
      <Stack align="center" gap="xs">
        <Text variant="label" tone="secondary">
          Llevas enfocado
        </Text>
        <FlipClock value={timerText(elapsed(session, now))} />
      </Stack>

      <Spacer />
      <Stack align="center" gap="sm">
        <HeroObject />
        <Button variant="ghost" label="Arte" onPress={() => setShowingArt(true)} />
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
