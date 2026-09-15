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
  BREATH_CYCLES,
  EXIT_SENTENCE,
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
 * The conscious exit (domain/exitRitual). Steps depend on the depth: soft breathes
 * and confirms; firm also types a sentence and says why. Every step's primary button
 * is "Seguir enfocado"; leaving is always the quiet option underneath.
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
  const step = steps[index] ?? 'confirm';
  const breath = breathState(now - openedAt);
  const next = () => setIndex((current) => Math.min(current + 1, steps.length - 1));
  const stay = () => router.back();
  const leave = () => {
    finish('cancelled', Date.now(), emptyToNull(reason));
    router.dismissTo('/(tabs)');
  };

  const body =
    step === 'breathe' ? (
      <Stack align="center" gap="sm">
        <Text variant="label" tone="secondary">
          Antes de decidir, respira.
        </Text>
        <Text variant="hero">{breath.done ? 'Listo' : PHASE_WORD[breath.phase]}</Text>
        <Text variant="title" tone="secondary">
          {breath.done ? '' : String(breath.secondsLeft)}
        </Text>
        <Text variant="caption" tone="tertiary">
          {breath.done ? 'Tres rondas. Ahora sí.' : `Ronda ${breath.cycle} de ${BREATH_CYCLES}`}
        </Text>
      </Stack>
    ) : step === 'type' ? (
      <Stack gap="md">
        <Text variant="title">Escribe la frase.</Text>
        <Card tone="muted">
          <Text variant="heading" align="center">
            {EXIT_SENTENCE}
          </Text>
        </Card>
        <FieldRow label="Frase" value={typed} onChangeText={setTyped} placeholder="Tal cual" autoFocus />
        <Text variant="caption" tone="tertiary">
          Sin autocompletar: es para que lo digas tú.
        </Text>
      </Stack>
    ) : step === 'why' ? (
      <Stack gap="md">
        <Text variant="title">¿Por qué terminas?</Text>
        <FieldRow label="Motivo" value={reason} onChangeText={setReason} placeholder="Una línea alcanza" autoFocus />
        <Text variant="caption" tone="tertiary">
          Queda guardado con la sesión. Nadie más lo ve.
        </Text>
      </Stack>
    ) : (
      <Stack gap="md">
        <Text variant="title">Terminar la sesión.</Text>
        <Text variant="body" tone="secondary">
          {`Llevas ${durationText(elapsed(session, now))} enfocado. Lo hecho queda contado; lo que falta, no.`}
        </Text>
      </Stack>
    );

  const canContinue =
    step === 'breathe' ? breath.done : step === 'type' ? sentenceMatches(typed) : true;

  const footer = (
    <>
      <Button label="Seguir enfocado" onPress={stay} />
      {step === 'confirm' ? (
        <Button variant="ghost" label="Terminar de verdad" onPress={leave} />
      ) : (
        <Button variant="ghost" label="Continuar" onPress={next} disabled={!canContinue} />
      )}
    </>
  );

  return (
    <Screen footer={footer}>
      <Spacer />
      {body}
      <Spacer />
      {step === 'breathe' ? <ProgressBar progress={breath.progress} /> : null}
      <Text variant="caption" tone="tertiary" align="center">
        {`Paso ${Math.min(index + 1, steps.length)} de ${steps.length}`}
      </Text>
    </Screen>
  );
}
