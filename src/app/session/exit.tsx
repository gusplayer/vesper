import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { goBack } from '../../lib/goBack';

import { useFocusStore, useRunningSession } from '../../data';
import {
  BreathingObject,
  Button,
  Card,
  FieldRow,
  InkFlood,
  ProgressBar,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import {
  breathCyclesFor,
  breathState,
  breathTotalMs,
  exitStepsFor,
  phaseDurationMs,
  releaseBreath,
  sentenceMatches,
} from '../../domain/exitRitual';
import { elapsed } from '../../domain/session';
import { SECOND } from '../../domain/time';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { emptyToNull } from '../../lib/text';
import { useBlockBack } from '../../lib/useBlockBack';
import { useNow } from '../../lib/useNow';

/** While the finger is on the object the phase word must keep up; at rest a second is plenty. */
const HELD_TICK_MS = 250;

/**
 * The conscious exit (domain/exitRitual), held rather than watched (ADR-0025): the
 * breathing clock only runs while the finger rests on the Vesper object, and letting
 * go mid-round sends that round back to its start. Soft: one round, then the way out
 * on the same screen. Firm: two rounds, then the sentence and an optional why. Every
 * screen's big button is "Seguir enfocado"; leaving is the quiet option underneath.
 *
 * Confirming runs the paper flood over the dark page and opens `session/closed`
 * underneath: the same language as entering, in reverse. A full-screen route without
 * a back gesture, and without Android's back button either: the ritual is the way
 * out, and a system back mid-breath would throw away the round and the typed reason.
 *
 * The flood sits outside the page, at a fixed place in the tree, so it survives the
 * session closing under it and lingers through the fade into `session/closed` instead
 * of leaving the dark route showing for a frame. Opened with no session (a stale link),
 * the route goes to Focus; a deep session, which has no ritual, goes back to itself.
 */
export default function ExitScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings();
  const t = strings.session.exit;
  const session = useRunningSession();
  const [arrivedWithSession] = useState(session !== null);
  const finish = useFocusStore((state) => state.finish);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  // True after tapping the way out with the sentence typed wrong, until the next keystroke.
  const [mismatch, setMismatch] = useState(false);
  const [reason, setReason] = useState('');
  // Breathing banked from released rounds, plus the current hold if there is one.
  const [completedMs, setCompletedMs] = useState(0);
  const [pressedAt, setPressedAt] = useState<number | null>(null);
  // True after a release that threw away a half round, until the next press.
  const [released, setReleased] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // The session closes from here at most once, however the flood is retriggered.
  const leftRef = useRef(false);
  const now = useNow(pressedAt === null ? SECOND : HELD_TICK_MS);
  const steps = session === null ? [] : exitStepsFor(session.depth);
  // Deep has no way out by hand (domain/exitRitual): only a link could land it here.
  const noRitual = session !== null && steps.length === 0;
  useEffect(() => {
    if (noRitual) {
      goBack(router);
    }
  }, [noRitual, router]);

  const leave = () => {
    if (leftRef.current) {
      return;
    }
    leftRef.current = true;
    setLeaving(true);
  };
  // The page is paper: close the session under it and swap the route while it lingers.
  // A null close means the timer won the race and SessionGate is already on its way to
  // the completion page.
  const flooded = () => {
    const closed = finish('cancelled', Date.now(), emptyToNull(reason));
    if (closed !== null) {
      router.replace('/session/closed');
    }
    setLeaving(false);
  };
  const flood = <InkFlood active={leaving} tone="paper" onDone={flooded} />;
  // The page, then the flood, always in these two places.
  const withFlood = (page: ReactNode) => (
    <>
      {page}
      {flood}
    </>
  );

  if (session === null) {
    return arrivedWithSession ? withFlood(null) : <Redirect href="/" />;
  }
  if (noRitual) {
    return withFlood(null);
  }

  const step = steps[index] ?? 'breathe';
  const cycles = breathCyclesFor(session.depth);
  const totalMs = breathTotalMs(cycles);
  const heldMs = completedMs + (pressedAt === null ? 0 : Math.max(0, now - pressedAt));
  const breath = breathState(heldMs, cycles);
  const served = durationText(elapsed(session, now));

  const stay = () => goBack(router);
  // Opened from a break, going back lands on the break, not on focus.
  const stayLabel = session.breakStartedAt === null ? strings.session.stayFocused : t.backToBreak;

  const pressIn = () => {
    if (breath.done) {
      return;
    }
    setReleased(false);
    setPressedAt(Date.now());
  };
  const pressOut = () => {
    if (pressedAt === null) {
      return;
    }
    const held = completedMs + Math.max(0, Date.now() - pressedAt);
    const banked = releaseBreath(held);
    // A round left halfway starts over; the screen says so until the next press.
    setReleased(banked < held && banked < totalMs);
    setCompletedMs(banked);
    setPressedAt(null);
  };

  if (step === 'breathe') {
    const last = steps.length === 1;
    const pressing = pressedAt !== null && !breath.done;
    return withFlood(
      <Screen
        footer={
          <>
            <Button label={stayLabel} onPress={stay} />
            <Button
              variant="ghost"
              label={last ? t.endWithServed(served) : t.wantToEnd}
              onPress={last ? leave : () => setIndex(1)}
              disabled={!breath.done}
            />
          </>
        }
      >
        <Stack align="center" gap="xs">
          <Text variant="label" tone="secondary">
            {t.breatheFirst}
          </Text>
          {/* The phase word is the rhythm for a screen reader too: each change is announced. */}
          <Text variant="hero" live>
            {breath.done ? strings.common.done : pressing ? t.phase[breath.phase] : ''}
          </Text>
          <Text variant="title" tone="secondary">
            {pressing ? String(breath.secondsLeft) : ''}
          </Text>
        </Stack>
        <Spacer />
        <Stack align="center">
          <BreathingObject
            phase={pressing ? breath.phase : 'rest'}
            phaseMs={phaseDurationMs(breath.phase)}
            onPressIn={pressIn}
            onPressOut={pressOut}
            accessibilityLabel={t.holdLabel}
            accessibilityHint={t.holdHint}
          />
        </Stack>
        <Spacer />
        <Stack align="center" gap="xs">
          {breath.done ? (
            <>
              <Text variant="caption" tone="secondary" align="center" live>
                {t.counted}
              </Text>
              {/* Keeps the block two lines tall, so the object does not move when the rounds end. */}
              <Text variant="caption" tone="secondary" align="center">
                {''}
              </Text>
            </>
          ) : (
            <>
              <Text variant="caption" tone="secondary" align="center" live>
                {released ? t.releasedHint : t.holdHint}
              </Text>
              <Text variant="caption" tone="secondary" align="center">
                {cycles === 1 ? t.oneRound : t.round(breath.cycle, cycles)}
              </Text>
            </>
          )}
        </Stack>
        <ProgressBar progress={breath.progress} accessibilityLabel={t.progressLabel} />
      </Screen>,
    );
  }

  const ready = sentenceMatches(typed, t.sentence);
  // The way out stays tappable: a wrong sentence answers with a line, not with silence.
  const tryLeave = () => {
    if (ready) {
      leave();
    } else {
      setMismatch(true);
    }
  };
  const type = (text: string) => {
    setTyped(text);
    setMismatch(false);
  };
  return withFlood(
    <Screen
      avoidKeyboard
      footer={
        <>
          <Button label={stayLabel} onPress={stay} />
          <Button variant="ghost" label={t.endWithServed(served)} onPress={tryLeave} />
        </>
      }
    >
      <Spacer />
      <Stack gap="lg">
        <Stack gap="md">
          <Text variant="title" align="center">
            {t.typeSentence}
          </Text>
          <Card tone="muted">
            <Text variant="heading" align="center">
              {t.sentence}
            </Text>
          </Card>
          {/* Typed, not completed: no autocorrect, no suggestions. */}
          <FieldRow
            label={t.sentenceField}
            value={typed}
            onChangeText={type}
            placeholder={t.sentencePlaceholder}
            autoFocus
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="done"
          />
          {mismatch ? (
            <Text variant="caption" tone="danger" align="center" live>
              {t.sentenceMismatch}
            </Text>
          ) : null}
        </Stack>
        <Stack gap="xs">
          <FieldRow
            label={t.reasonField}
            value={reason}
            onChangeText={setReason}
            placeholder={t.reasonPlaceholder}
            multiline
          />
          <Text variant="caption" tone="secondary" align="center">
            {t.reasonHint}
          </Text>
        </Stack>
      </Stack>
      <Spacer />
    </Screen>,
  );
}
