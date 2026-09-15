import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useFocusStore, useRunningSession } from '../../data';
import {
  Button,
  Card,
  FieldRow,
  ProgressBar,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import {
  EXIT_SENTENCE,
  breathCyclesFor,
  breathState,
  exitStepsFor,
  sentenceMatches,
  type BreathPhase,
} from '../../domain/exitRitual';
import { elapsed } from '../../domain/session';
import { SECOND } from '../../domain/time';
import { durationText } from '../../lib/format';
import { emptyToNull } from '../../lib/text';
import { useNow } from '../../lib/useNow';

const PHASE_WORD: Record<BreathPhase, string> = {
  inhale: 'Inhala',
  hold: 'Sostén',
  exhale: 'Exhala',
};

/**
 * The conscious exit (domain/exitRitual), kept short so it never costs the time it
 * protects. Soft: one round of breathing, then the way out on the same screen. Firm:
 * two rounds, then the sentence and an optional why. Every screen's big button is
 * "Seguir enfocado"; leaving is the quiet option underneath.
 *
 * A full-screen route without a back gesture: the ritual is the way out.
 */
export default function ExitScreen() {
  const router = useRouter();
  const session = useRunningSession();
  const finish = useFocusStore((state) => state.finish);
  const now = useNow(SECOND);
  const [openedAt] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  if (session === null) {
    return null;
  }

  const steps = exitStepsFor(session.depth);
  const step = steps[index] ?? 'breathe';
  const cycles = breathCyclesFor(session.depth);
  const breath = breathState(now - openedAt, cycles);
  const stay = () => router.back();
  const leave = () => {
    finish('cancelled', Date.now(), emptyToNull(reason));
    router.dismissTo('/(tabs)');
  };
  const served = durationText(elapsed(session, now));

  if (step === 'breathe') {
    const last = steps.length === 1;
    return (
      <Screen
        footer={
          <>
            <Button label="Seguir enfocado" onPress={stay} />
            <Button
              variant="ghost"
              label={last ? `Terminar · llevas ${served}` : 'Quiero terminar'}
              onPress={last ? leave : () => setIndex(1)}
              disabled={!breath.done}
            />
          </>
        }
      >
        <Spacer />
        <Stack align="center" gap="sm">
          <Text variant="label" tone="secondary">
            Antes de decidir, respira.
          </Text>
          <Text variant="hero">{breath.done ? 'Listo' : PHASE_WORD[breath.phase]}</Text>
          <Text variant="title" tone="secondary">
            {breath.done ? '' : String(breath.secondsLeft)}
          </Text>
          <Text variant="caption" tone="secondary">
            {breath.done
              ? 'Lo hecho queda contado; lo que falta, no.'
              : cycles === 1
                ? 'Una ronda.'
                : `Ronda ${breath.cycle} de ${cycles}`}
          </Text>
        </Stack>
        <Spacer />
        <ProgressBar progress={breath.progress} />
      </Screen>
    );
  }

  const ready = sentenceMatches(typed);
  return (
    <Screen
      footer={
        <>
          <Button label="Seguir enfocado" onPress={stay} />
          <Button variant="ghost" label={`Terminar · llevas ${served}`} onPress={leave} disabled={!ready} />
        </>
      }
    >
      <Spacer />
      <Stack gap="lg">
        <Stack gap="md">
          <Text variant="title">Escribe la frase.</Text>
          <Card tone="muted">
            <Text variant="heading" align="center">
              {EXIT_SENTENCE}
            </Text>
          </Card>
          <FieldRow label="Frase" value={typed} onChangeText={setTyped} placeholder="Tal cual" autoFocus />
        </Stack>
        <Stack gap="xs">
          <FieldRow label="Motivo" value={reason} onChangeText={setReason} placeholder="Opcional" />
          <Text variant="caption" tone="secondary">
            Queda guardado con la sesión. Nadie más lo ve.
          </Text>
        </Stack>
      </Stack>
      <Spacer />
    </Screen>
  );
}
