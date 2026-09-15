import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { dayBounds } from '../domain/day';
import {
  FIRM_WAIT_MS,
  HOLD_MS,
  canGiveUp,
  isDue,
  remaining,
  sessionProgress,
} from '../domain/session';
import type { Session } from '../domain/types';
import * as activitiesRepo from '../db/repositories/activities';
import * as sessionsRepo from '../db/repositories/sessions';
import { Body } from '../design/components/Body';
import { Caption } from '../design/components/Caption';
import { FieldGroup } from '../design/components/FieldGroup';
import { HoldToConfirm } from '../design/components/HoldToConfirm';
import { Label } from '../design/components/Label';
import { ProgressRule } from '../design/components/ProgressRule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';
import { TextAction } from '../design/components/TextAction';
import { TextField } from '../design/components/TextField';
import { Timer } from '../design/components/Timer';
import { timerText } from '../lib/format';
import { GIVE_UP_LABEL } from '../lib/labels';
import { emptyToNull } from '../lib/text';
import { useNow } from '../lib/useNow';
import { useSessionStore } from '../store/session';

/**
 * The active session. A route and not a pager page, so no swipe can abandon it —
 * ADR-0009. The back gesture is disabled in the root layout for the same reason.
 *
 * The clock is `now - startedAt`, never a sum of ticks, so backgrounding the app does
 * not slow the session down.
 *
 * Three states: running, leaving (firm depth, the "why" field is open), and closed.
 * When the timer runs out the route does not leave: it shows what was done and the
 * intention as written, and waits for `volver` — ADR-0015. A cancelled session never
 * passes through here: there is nothing to close.
 */
export default function SessionScreen() {
  const router = useRouter();
  const now = useNow(1000);
  const session = useSessionStore((state) => state.session);
  const finish = useSessionStore((state) => state.finish);
  const setIntention = useSessionStore((state) => state.setIntention);
  const registerInterruption = useSessionStore((state) => state.registerInterruption);

  const [intentionDraft, setIntentionDraft] = useState(session?.intention ?? '');
  /** Set when a firm hold completed: the "why" field is open and the wait is running. */
  const [exitStartedAt, setExitStartedAt] = useState<number | null>(null);
  const [exitReason, setExitReason] = useState('');
  /** The completed session, kept here after the store has let go of it. */
  const [closed, setClosed] = useState<Session | null>(null);
  /** Guards `router.back()`: effects keep running for a tick after it, and once is enough. */
  const left = useRef(false);

  function leave(): void {
    if (!left.current) {
      left.current = true;
      router.back();
    }
  }

  // Leaving the app counts as an interruption in firm and deep. It never cancels.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        registerInterruption();
      }
    });
    return () => subscription.remove();
  }, [registerInterruption]);

  // The timer ran out. Close as completed, crediting the full planned time, and stay:
  // the closing state reads it back — ADR-0015.
  useEffect(() => {
    if (session !== null && isDue(session, now)) {
      setClosed(finish('completed', now));
    }
  }, [session, now, finish]);

  // The firm wait elapsed: the user gets to leave, with whatever they wrote.
  useEffect(() => {
    if (exitStartedAt !== null && now - exitStartedAt >= FIRM_WAIT_MS) {
      finish('cancelled', now, emptyToNull(exitReason));
      leave();
    }
    // `leave` is stable by construction: it only touches a ref and the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitStartedAt, now, exitReason, finish]);

  const shown = closed ?? session;

  // Two reads that do not change during a session, and the route renders every second.
  const { ordinal, activityLabel } = useMemo(() => {
    const { dayStart, dayEnd } = dayBounds(now);
    return {
      ordinal: sessionsRepo.listBetween(dayStart, dayEnd).length,
      activityLabel:
        shown === null ? '' : (activitiesRepo.findById(shown.activityId)?.label ?? ''),
    };
    // Only the identity of the session matters, not the tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.id]);

  if (shown === null) {
    return (
      <Screen>
        <ScreenHeader left="sesión" right="volver" onPressRight={leave} />
        <Caption>no hay ninguna sesión corriendo</Caption>
      </Screen>
    );
  }

  function onHoldConfirmed(): void {
    if (session === null) {
      return;
    }
    if (session.depth === 'firm') {
      setExitStartedAt(Date.now());
      return;
    }
    finish('cancelled', Date.now());
    leave();
  }

  const waitLeft =
    exitStartedAt === null ? 0 : Math.max(0, FIRM_WAIT_MS - (now - exitStartedAt));

  return (
    <Screen>
      <ScreenHeader left={activityLabel} right={`sesión ${ordinal} de hoy`} />

      <Timer
        value={closed !== null ? timerText(closed.actualMs) : timerText(remaining(shown, now))}
      />
      <ProgressRule progress={closed !== null ? 1 : sessionProgress(shown, now)} />

      {closed !== null ? (
        <>
          {closed.intention === null ? (
            <Caption>sin intención escrita</Caption>
          ) : (
            <Body>{closed.intention}</Body>
          )}
          <TextAction label="volver" onPress={leave} />
        </>
      ) : exitStartedAt === null ? (
        <>
          <TextField
            value={intentionDraft}
            onChangeText={setIntentionDraft}
            onEndEditing={() => setIntention(intentionDraft)}
            placeholder="intención"
            accessibilityLabel="intención de esta sesión"
          />
          <HoldToConfirm
            label={GIVE_UP_LABEL[shown.depth]}
            holdMs={HOLD_MS}
            enabled={canGiveUp(shown.depth)}
            onConfirm={onHoldConfirmed}
          />
        </>
      ) : (
        <FieldGroup>
          <Label>¿por qué?</Label>
          <TextField
            value={exitReason}
            onChangeText={setExitReason}
            placeholder="escribe lo que quieras"
            autoFocus
            accessibilityLabel="motivo para terminar"
          />
          <TextAction
            label={`sales en ${Math.ceil(waitLeft / 1000)}s · seguir`}
            onPress={() => setExitStartedAt(null)}
            accessibilityLabel="seguir en la sesión"
          />
        </FieldGroup>
      )}

      {shown.interruptions === 0 ? null : (
        <Caption>{`${shown.interruptions} interrupción(es)`}</Caption>
      )}
    </Screen>
  );
}
