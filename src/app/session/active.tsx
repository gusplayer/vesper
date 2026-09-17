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
import {
  allowsBreaks,
  breakAvailableIn,
  breakEndsAt,
  canTakeBreak,
  elapsed,
  sessionProgress,
} from '../../domain/session';
import { EmergencySheet } from '../../features/session/EmergencySheet';
import { ModeDetailsSheet } from '../../features/modes/ModeDetailsSheet';
import { FocusArt } from '../../features/session/FocusArt';
import { useStrings } from '../../i18n';
import { clockText, durationText, timerText } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { useBlockBack } from '../../lib/useBlockBack';
import { useOrientation } from '../../lib/useOrientation';
import { allowRotation, lockPortrait } from '../../platform/orientation';

/**
 * The running session. The store already flipped the theme to dark. The clock is
 * `now - startedAt`, never accumulated ticks, so it survives the background. How the
 * session ends depends on the depth chosen on the mode (domain/session). The timer
 * running out is handled by SessionGate, whether or not this screen is mounted.
 *
 * A break (ADR-0022) is a view of the same route: the store flipped the theme back to
 * light, the clock counts the break down, and the one button brings the session back.
 */
export default function ActiveSessionScreen() {
  const router = useRouter();
  const strings = useStrings().session;
  const t = strings.active;
  const session = useRunningSession();
  const modeId = useFocusStore((state) => state.modeId);
  const mode = useMode(modeId ?? undefined);
  const emergencyLeft = useSettings().emergencyLeft;
  const finish = useFocusStore((state) => state.finish);
  const takeBreak = useFocusStore((state) => state.takeBreak);
  const resume = useFocusStore((state) => state.resume);
  const registerInterruption = useFocusStore((state) => state.registerInterruption);
  const spendEmergency = useAppStore((state) => state.useEmergency);
  const now = useNow(1000);
  const orientation = useOrientation();

  useBlockBack();
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
  // The session closes from here at most once; the gate may beat it to it.
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

  // The break: the clock counts down to when the session comes back. No art, no
  // emergency; the session is still there, only waiting.
  const breakEnd = breakEndsAt(session);
  if (breakEnd !== null) {
    return (
      <Screen
        footer={
          <>
            <Button label={strings.break.resumeNow} onPress={() => resume(Date.now())} />
            <Button variant="ghost" label={strings.break.endSession} onPress={() => router.push('/session/exit')} />
          </>
        }
      >
        <Spacer />
        <Stack align="center" gap="sm">
          <Text variant="label" tone="secondary">
            {strings.break.title}
          </Text>
          <FlipClock value={timerText(Math.max(0, breakEnd - now))} />
          <Text variant="body" tone="secondary" align="center">
            {strings.break.body(clockText(breakEnd))}
          </Text>
        </Stack>
        <Spacer />
      </Screen>
    );
  }

  const endButton =
    session.depth === 'deep' ? (
      <Button label={t.deepOnlyTimer} onPress={() => undefined} disabled />
    ) : (
      <Button label={t.end} onPress={() => router.push('/session/exit')} />
    );

  const breakButton = allowsBreaks(session.depth) ? (
    <Button
      variant="ghost"
      label={canTakeBreak(session, now) ? t.takeBreak : t.breakIn(durationText(breakAvailableIn(session, now)))}
      disabled={!canTakeBreak(session, now)}
      onPress={() => takeBreak(Date.now())}
    />
  ) : null;

  const footer = (
    <>
      {endButton}
      {breakButton}
      <Button
        variant="ghost"
        label={emergencyLeft > 0 ? t.emergencyLeft(emergencyLeft) : t.noEmergencyLeft}
        disabled={emergencyLeft === 0}
        onPress={() => setAskingEmergency(true)}
      />
    </>
  );

  // An open session has no end to draw: the bar gives way to a line.
  const progress = session.open ? (
    <Text variant="caption" tone="secondary" align="center">
      {t.openSince(clockText(session.startedAt))}
    </Text>
  ) : (
    <ProgressBar progress={sessionProgress(session, now)} />
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
                {mode === null ? t.focused : mode.name}
              </Text>
            </Stack>
            <FocusArt session={session} now={now} onPress={() => setShowingArt(false)} layout="landscape" />
          </Stack>
          {progress}
        </Screen>
      );
    }
    return (
      <Screen>
        <Spacer />
        <Stack align="center" gap="lg">
          <FlipClock value={timerText(elapsed(session, now))} scale={1.6} />
          <Text variant="label" tone="secondary">
            {mode === null ? t.focused : mode.name}
          </Text>
          <Button variant="ghost" label={t.art} onPress={() => setShowingArt(true)} />
        </Stack>
        <Spacer />
        {progress}
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
        {progress}
        {askingEmergency ? (
          <EmergencySheet
            left={emergencyLeft}
            onStay={() => setAskingEmergency(false)}
            onUse={() => {
              spendEmergency();
              leave(strings.emergency.reason);
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
          {t.elapsedLabel}
        </Text>
        <FlipClock value={timerText(elapsed(session, now))} />
      </Stack>

      <Spacer />
      <Stack align="center" gap="sm">
        <HeroObject />
        <Button variant="ghost" label={t.art} onPress={() => setShowingArt(true)} />
      </Stack>
      <Spacer />

      <Stack align="center" gap="xs">
        <Pressable
          onPress={() => setShowingMode(true)}
          disabled={mode === null}
          accessibilityRole="button"
          accessibilityLabel={t.modeLabel(mode?.name ?? t.fallbackName)}
        >
          <Stack direction="row" align="center" gap="sm">
            <Text variant="heading">{mode?.name ?? t.fallbackName}</Text>
            {mode === null ? null : <Icon name="info" size="sm" tone="tertiary" />}
          </Stack>
        </Pressable>
      </Stack>
      {mode === null ? null : (
        <ModeDetailsSheet mode={mode} visible={showingMode} onClose={() => setShowingMode(false)} />
      )}

      <Stack gap="sm">
        {progress}
        {session.interruptions > 0 ? (
          <Text variant="caption" tone="secondary" align="right">
            {t.interruptions(session.interruptions)}
          </Text>
        ) : null}
      </Stack>

      {askingEmergency ? (
        <EmergencySheet
          left={emergencyLeft}
          onStay={() => setAskingEmergency(false)}
          onUse={() => {
            spendEmergency();
            leave(strings.emergency.reason);
          }}
        />
      ) : null}
    </Screen>
  );
}
