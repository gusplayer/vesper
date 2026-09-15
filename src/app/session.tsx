import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { dayBounds } from '../domain/day';
import { FIRM_WAIT_MS, HOLD_MS, canGiveUp, elapsed, isDue, remaining } from '../domain/session';
import type { Session } from '../domain/types';
import * as activitiesRepo from '../db/repositories/activities';
import * as sessionsRepo from '../db/repositories/sessions';
import { Body } from '../design/components/Body';
import { Caption } from '../design/components/Caption';
import { HoldToConfirm } from '../design/components/HoldToConfirm';
import { Label } from '../design/components/Label';
import { ProgressRule } from '../design/components/ProgressRule';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';
import { TextAction } from '../design/components/TextAction';
import { TextField } from '../design/components/TextField';
import { Timer } from '../design/components/Timer';
import { timerText } from '../lib/format';
import { useNow } from '../lib/useNow';
import { useSessionStore } from '../store/session';

const GIVE_UP_LABEL: Record<'soft' | 'firm' | 'deep', string> = {
  soft: 'mantén pulsado para terminar',
  firm: 'mantén pulsado para terminar',
  deep: 'profundo · solo el timer termina',
};

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
      finish('cancelled', now, exitReason.trim() === '' ? null : exitReason.trim());
      router.back();
    }
  }, [exitStartedAt, now, exitReason, finish, router]);

  const { dayStart, dayEnd } = dayBounds(now);
  const ordinal = sessionsRepo.listBetween(dayStart, dayEnd).length;
  const shown = closed ?? session;
  const activityLabel =
    activitiesRepo.listActive().find((activity) => activity.id === shown?.activityId)?.label ?? '';

  if (closed !== null) {
    return (
      <Screen>
        <ScreenHeader left={activityLabel} right={`sesión ${ordinal} de hoy`} />

        <Timer value={timerText(closed.actualMs)} />
        <ProgressRule progress={1} />

        {closed.intention === null ? (
          <Caption>sin intención escrita</Caption>
        ) : (
          <Body>{closed.intention}</Body>
        )}

        <TextAction label="volver" onPress={() => router.back()} />
        {closed.interruptions === 0 ? null : (
          <Caption>{`${closed.interruptions} interrupción(es)`}</Caption>
        )}
      </Screen>
    );
  }

  if (session === null) {
    return (
      <Screen>
        <ScreenHeader left="sesión" right="volver" onPressRight={() => router.back()} />
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
    router.back();
  }

  const waitLeft =
    exitStartedAt === null ? 0 : Math.max(0, FIRM_WAIT_MS - (now - exitStartedAt));

  return (
    <Screen>
      <ScreenHeader left={activityLabel} right={`sesión ${ordinal} de hoy`} />

      <Timer value={timerText(remaining(session, now))} />
      <ProgressRule progress={elapsed(session, now) / session.plannedMs} />

      {exitStartedAt === null ? (
        <TextField
          value={intentionDraft}
          onChangeText={setIntentionDraft}
          onEndEditing={() => setIntention(intentionDraft)}
          placeholder="intención"
          accessibilityLabel="intención de esta sesión"
        />
      ) : (
        <View>
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
        </View>
      )}

      <HoldToConfirm
        label={GIVE_UP_LABEL[session.depth]}
        holdMs={HOLD_MS}
        enabled={canGiveUp(session.depth) && exitStartedAt === null}
        onConfirm={onHoldConfirmed}
      />
      {session.interruptions === 0 ? null : (
        <Caption>{`${session.interruptions} interrupción(es)`}</Caption>
      )}
    </Screen>
  );
}
