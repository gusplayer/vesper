import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable } from 'react-native';

import {
  Button,
  FlipClock,
  HeroObject,
  Icon,
  ProgressBar,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import { useAppStore, useFocusStore, useMode, useRunningSession, useSettings } from '../../data';
import { countText } from '../../data/modes';
import { elapsed, isDue, sessionProgress } from '../../domain/session';
import { EmergencySheet } from '../../features/session/EmergencySheet';
import { ModeDetailsSheet } from '../../features/modes/ModeDetailsSheet';
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
  const [askingEmergency, setAskingEmergency] = useState(false);
  // The drawing view (ADR-0018). A view, not a state: exit rules do not change.
  // `?art=1` opens it directly, for links and for reviewing.
  const params = useLocalSearchParams<{ art?: string }>();
  const [showingArt, setShowingArt] = useState(params.art === '1');
  const [showingMode, setShowingMode] = useState(false);
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
            {mode === null ? 'Enfocado' : mode.name}
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
        <Pressable
          onPress={() => setShowingMode(true)}
          disabled={mode === null}
          accessibilityRole="button"
          accessibilityLabel={`${mode?.name ?? 'Sesión'}. Ver qué hace este modo`}
        >
          <Stack direction="row" align="center" gap="sm">
            <Text variant="heading">{mode?.name ?? 'Sesión'}</Text>
            {mode === null ? null : <Icon name="info" size="sm" tone="tertiary" />}
          </Stack>
        </Pressable>
      </Stack>
      {mode === null ? null : (
        <ModeDetailsSheet mode={mode} visible={showingMode} onClose={() => setShowingMode(false)} />
      )}

      <Stack gap="sm">
        <ProgressBar progress={sessionProgress(session, now)} />
        {session.interruptions > 0 ? (
          <Text variant="caption" tone="secondary" align="right">
            {countText(session.interruptions, 'interrupción', 'interrupciones')}
          </Text>
        ) : null}
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
