import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

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
 * a back gesture: the ritual is the way out.
 */
export default function ExitScreen() {
  const router = useRouter();
  const strings = useStrings();
  const t = strings.session.exit;
  const session = useRunningSession();
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

  if (session === null) {
    return null;
  }

  const steps = exitStepsFor(session.depth);
  const step = steps[index] ?? 'breathe';
  const cycles = breathCyclesFor(session.depth);
  const totalMs = breathTotalMs(cycles);
  const heldMs = completedMs + (pressedAt === null ? 0 : Math.max(0, now - pressedAt));
  const breath = breathState(heldMs, cycles);
  const served = durationText(elapsed(session, now));

  const stay = () => router.back();
  const leave = () => {
    if (leftRef.current) {
      return;
    }
    leftRef.current = true;
    setLeaving(true);
  };
  // The page is paper: close the session under it and swap the route while it lingers.
  const flooded = () => {
    finish('cancelled', Date.now(), emptyToNull(reason));
    router.replace('/session/closed');
    setLeaving(false);
  };

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

  const flood = <InkFlood active={leaving} tone="paper" onDone={flooded} />;

  if (step === 'breathe') {
    const last = steps.length === 1;
    const pressing = pressedAt !== null && !breath.done;
    return (
      <Screen
        footer={
          <>
            <Button label={strings.session.stayFocused} onPress={stay} />
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
          <Text variant="hero">{breath.done ? strings.common.done : pressing ? t.phase[breath.phase] : ''}</Text>
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
              <Text variant="caption" tone="secondary" align="center">
                {t.counted}
              </Text>
              {/* Keeps the block two lines tall, so the object does not move when the rounds end. */}
              <Text variant="caption" tone="secondary" align="center">
                {''}
              </Text>
            </>
          ) : (
            <>
              <Text variant="caption" tone="secondary" align="center">
                {released ? t.releasedHint : t.holdHint}
              </Text>
              <Text variant="caption" tone="secondary" align="center">
                {cycles === 1 ? t.oneRound : t.round(breath.cycle, cycles)}
              </Text>
            </>
          )}
        </Stack>
        <ProgressBar progress={breath.progress} />
        {flood}
      </Screen>
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
  return (
    <Screen
      footer={
        <>
          <Button label={strings.session.stayFocused} onPress={stay} />
          <Button variant="ghost" label={t.endWithServed(served)} onPress={tryLeave} />
        </>
      }
    >
      <Spacer />
      <Stack gap="lg">
        <Stack gap="md">
          <Text variant="title">{t.typeSentence}</Text>
          <Card tone="muted">
            <Text variant="heading" align="center">
              {t.sentence}
            </Text>
          </Card>
          <FieldRow
            label={t.sentenceField}
            value={typed}
            onChangeText={type}
            placeholder={t.sentencePlaceholder}
            autoFocus
          />
          {mismatch ? (
            <Text variant="caption" tone="danger">
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
          />
          <Text variant="caption" tone="secondary">
            {t.reasonHint}
          </Text>
        </Stack>
      </Stack>
      <Spacer />
      {flood}
    </Screen>
  );
}
