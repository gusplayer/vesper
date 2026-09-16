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
import { breathCyclesFor, breathState, exitStepsFor, sentenceMatches } from '../../domain/exitRitual';
import { elapsed } from '../../domain/session';
import { SECOND } from '../../domain/time';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { emptyToNull } from '../../lib/text';
import { useNow } from '../../lib/useNow';

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
  const strings = useStrings();
  const t = strings.session.exit;
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
        <Spacer />
        <Stack align="center" gap="sm">
          <Text variant="label" tone="secondary">
            {t.breatheFirst}
          </Text>
          <Text variant="hero">{breath.done ? strings.common.done : t.phase[breath.phase]}</Text>
          <Text variant="title" tone="secondary">
            {breath.done ? '' : String(breath.secondsLeft)}
          </Text>
          <Text variant="caption" tone="secondary">
            {breath.done ? t.counted : cycles === 1 ? t.oneRound : t.round(breath.cycle, cycles)}
          </Text>
        </Stack>
        <Spacer />
        <ProgressBar progress={breath.progress} />
      </Screen>
    );
  }

  const ready = sentenceMatches(typed, t.sentence);
  return (
    <Screen
      footer={
        <>
          <Button label={strings.session.stayFocused} onPress={stay} />
          <Button variant="ghost" label={t.endWithServed(served)} onPress={leave} disabled={!ready} />
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
            onChangeText={setTyped}
            placeholder={t.sentencePlaceholder}
            autoFocus
          />
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
    </Screen>
  );
}
