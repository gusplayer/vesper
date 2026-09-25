import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  Button,
  FlipClock,
  HeroObject,
  Icon,
  IconCircle,
  InkFlood,
  ProgressBar,
  Screen,
  Spacer,
  Stack,
  StatusNote,
  Tappable,
  Text,
} from '../../design/components';
import { useFocusStore, useMode, useRunningSession, useSchedules, useSettings } from '../../data';
import {
  breakAvailableIn,
  breakEndsAt,
  breakReachable,
  canTakeBreak,
  elapsed,
  plannedEndAt,
  sessionProgress,
} from '../../domain/session';
import { ModeDetailsSheet } from '../../features/modes/ModeDetailsSheet';
import { FocusArt } from '../../features/session/FocusArt';
import { sessionRoutine } from '../../features/session/sessionRoutine';
import { useStrings } from '../../i18n';
import { clockText, durationText, timerText } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { useBlockBack } from '../../lib/useBlockBack';
import { useOrientation } from '../../lib/useOrientation';
import { allowRotation, lockPortrait } from '../../platform/orientation';

/** Which dissolve is running: paper into the break, ink back into the session. */
type FloodTone = 'ink' | 'paper';

/**
 * The running session. The store already flipped the theme to dark. The clock is
 * `now - startedAt`, never accumulated ticks, so it survives the background. How the
 * session ends depends on the depth chosen on the mode (domain/session). The timer
 * running out is handled by SessionGate, whether or not this screen is mounted.
 *
 * Leaving by hand is never done here (ADR-0025): "Terminar" opens `session/exit`, the
 * life buoy top right opens `session/emergency`, and deep has neither button, only a
 * caption saying the timer is the way out.
 *
 * A break (ADR-0022) is a view of the same route: the store flipped the theme back to
 * light, the clock counts the break down, and the one button brings the session back.
 * Both ways are dissolves from the button that was tapped: paper over the session
 * into the break, ink over the break into the session, so the scheme change hides
 * under the flood. A break that runs out on its own (SessionGate) swaps in place:
 * nobody tapped, so there is nowhere for the ink to start. ADR-0025 §3 asks for the
 * route fade there, which an in-place scheme change cannot give; that is open.
 *
 * Opened with no session running — a Live Activity that outlived its session, a stale
 * link — the route has nothing to show and no way back, so it sends the user to Focus.
 * A session that ends while the screen is open is not that case: whoever ended it
 * (SessionGate, the exit ritual, the emergency) is already navigating.
 */
export default function ActiveSessionScreen() {
  const router = useRouter();
  const strings = useStrings().session;
  const t = strings.active;
  const session = useRunningSession();
  const [arrivedWithSession] = useState(session !== null);
  const modeId = useFocusStore((state) => state.modeId);
  const mode = useMode(modeId ?? undefined);
  const settings = useSettings();
  const emergencyLeft = settings.emergencyLeft;
  const schedules = useSchedules();
  const takeBreak = useFocusStore((state) => state.takeBreak);
  const resume = useFocusStore((state) => state.resume);
  const registerInterruption = useFocusStore((state) => state.registerInterruption);
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
  // The drawing view (ADR-0018). A view, not a state: exit rules do not change.
  // `?art=1` opens it directly, for links and for reviewing.
  const params = useLocalSearchParams<{ art?: string }>();
  const [showingArt, setShowingArt] = useState(params.art === '1');
  const [showingMode, setShowingMode] = useState(false);
  // The dissolve in flight, if any. The tone is state of its own so the flood keeps
  // its color while it lingers after `flood` drops back to null.
  const [flood, setFlood] = useState<FloodTone | null>(null);
  const [floodTone, setFloodTone] = useState<FloodTone>('ink');

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
    return arrivedWithSession ? null : <Redirect href="/" />;
  }

  const startFlood = (tone: FloodTone) => {
    setFloodTone(tone);
    setFlood(tone);
  };
  // The page is fully covered: swap what is under it, then let the flood linger.
  const flooded = () => {
    if (flood === 'paper') {
      takeBreak(Date.now());
    } else if (flood === 'ink') {
      resume(Date.now());
    }
    setFlood(null);
  };
  // One element, always last and always at the same place in the tree, so it survives
  // the switch between the session and the break and can linger across it.
  const withFlood = (view: ReactNode) => (
    <>
      {view}
      <InkFlood active={flood !== null} tone={floodTone} onDone={flooded} />
    </>
  );

  // The break: the clock counts down to when the session comes back. No art, no
  // emergency; the session is still there, only waiting.
  const breakEnd = breakEndsAt(session);
  if (breakEnd !== null) {
    return withFlood(
      <Screen
        footer={
          <>
            <Button label={strings.break.resumeNow} onPress={() => startFlood('ink')} />
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
      </Screen>,
    );
  }

  const deep = session.depth === 'deep';

  // A break only exists if the next one unlocks before the plan runs out: a 5 min
  // session never reaches its first break, so it never announces one. Until it
  // unlocks, when it will is a line under the bar, not a disabled button: faded text
  // would say it at tertiary contrast.
  const breakReady = canTakeBreak(session, now);
  const breakSoon = breakReachable(session, now) && !breakReady;
  const breakButton = breakReady ? (
    <Button variant="ghost" label={t.takeBreak} onPress={() => startFlood('paper')} />
  ) : null;
  const breakLine = breakSoon ? (
    <StatusNote align="center" text={t.breakIn(durationText(breakAvailableIn(session, now)))} />
  ) : null;

  // A routine that started this session says so, and when the session ends.
  const routine = sessionRoutine(session, schedules, settings.routineStarts);
  const routineEnd = plannedEndAt(session);
  const routineLine =
    routine === null || routineEnd === null ? null : (
      <StatusNote align="center" text={t.routine(routine.routine.name, clockText(routineEnd))} />
    );

  // Deep has no way out by hand, so it has no footer; the caption under the bar says so.
  const footer = deep ? undefined : (
    <>
      <Button label={t.end} onPress={() => router.push('/session/exit')} />
      {breakButton}
    </>
  );

  // The emergency lives top right, away from the footer: it costs one of five a month
  // and must not read as a sibling of the free break.
  const emergencyRow = (
    <Stack direction="row" justify="flex-end">
      <IconCircle
        name="life-buoy"
        tone="card"
        accessibilityLabel={t.emergencyLabel(emergencyLeft)}
        onPress={() => router.push('/session/emergency')}
      />
    </Stack>
  );

  // An open session has no end to draw: the bar gives way to a line.
  const progress = session.open ? (
    <StatusNote align="center" text={t.openSince(clockText(session.startedAt))} />
  ) : (
    <ProgressBar progress={sessionProgress(session, now)} accessibilityLabel={t.progressLabel} />
  );

  // Sideways, the session is a clock on a table: the time, the mode, the bar. No buttons;
  // turning the phone back is the way to act.
  if (orientation === 'landscape') {
    if (showingArt) {
      // Sideways with the drawing: the clock keeps the left third, the work the rest.
      return withFlood(
        <Screen>
          <Stack direction="row" gap="xl" grow align="stretch">
            <Stack justify="center" align="center" gap="sm">
              <FlipClock value={timerText(elapsed(session, now))} scale={0.8} />
              <Text variant="caption" tone="secondary" align="center">
                {mode === null ? t.focused : mode.name}
              </Text>
              <Button variant="ghost" label={t.clock} onPress={() => setShowingArt(false)} />
            </Stack>
            <FocusArt session={session} now={now} onPress={() => setShowingArt(false)} layout="landscape" />
          </Stack>
          {progress}
        </Screen>,
      );
    }
    return withFlood(
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
      </Screen>,
    );
  }

  // With the drawing open the clock shrinks and the middle of the page is the work;
  // the intention and the mode step aside, the exit stays where it always is.
  if (showingArt) {
    return withFlood(
      <Screen footer={footer}>
        {emergencyRow}
        <Stack align="center" gap="xs">
          <FlipClock value={timerText(elapsed(session, now))} scale={0.7} />
        </Stack>
        <Spacer />
        <Stack align="center" gap="sm">
          <FocusArt session={session} now={now} onPress={() => setShowingArt(false)} />
          <Button variant="ghost" label={t.clock} onPress={() => setShowingArt(false)} />
        </Stack>
        <Spacer />
        <Stack gap="sm">
          {progress}
          {breakLine}
        </Stack>
      </Screen>,
    );
  }

  return withFlood(
    <Screen footer={footer}>
      {emergencyRow}
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
        <Tappable
          onPress={() => setShowingMode(true)}
          disabled={mode === null}
          accessibilityLabel={mode?.name ?? t.fallbackName}
          accessibilityHint={mode === null ? undefined : t.modeHint}
        >
          <Stack direction="row" align="center" gap="sm">
            <Text variant="heading">{mode?.name ?? t.fallbackName}</Text>
            {mode === null ? null : <Icon name="info" size="sm" tone="tertiary" />}
          </Stack>
        </Tappable>
        {/* What the user said this session is for, in their words (PRD §2, ADR-0047 §10). */}
        {session.intention === null ? null : (
          <Text variant="body" tone="secondary" align="center" numberOfLines={3}>
            {t.intention(session.intention)}
          </Text>
        )}
        {routineLine}
      </Stack>
      {mode === null ? null : (
        <ModeDetailsSheet
          mode={mode}
          depth={session.depth}
          visible={showingMode}
          onClose={() => setShowingMode(false)}
        />
      )}

      <Stack gap="sm">
        {progress}
        {deep ? <StatusNote align="center" text={t.deepOnlyTimer} /> : null}
        {breakLine}
        {session.interruptions > 0 ? (
          <Text variant="caption" tone="secondary" align="center">
            {t.interruptions(session.interruptions)}
          </Text>
        ) : null}
      </Stack>
    </Screen>,
  );
}
