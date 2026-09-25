import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useSettings } from '../../data';
import { Button, PageHeader, Screen, Stack, StatusNote, Text } from '../../design/components';
import { canRetry, restoreFinished, type RestoreResult } from '../../features/restore/restorePlan';
import { useRestoreTarget } from '../../features/restore/restoreTarget';
import { runRestore } from '../../features/restore/runRestore';
import { useStrings, type Strings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { useBlockBack } from '../../lib/useBlockBack';
import { isIos } from '../../platform/capabilities';

/**
 * The restore itself (ADR-0048 §5–§7), and what came of it in one sentence: the key was
 * wrong, there was no connection, the backup needs a newer Vesper, only the circle came
 * back, or everything did. It starts on arrival — the tap that led here was the decision
 * — and nothing can interrupt it: no back gesture, no back button, until it answers.
 *
 * After a restore the key is new (the old phone is shut out), the permissions are asked
 * again in their own flows (rule 8), and on an iPhone the apps of each mode are picked
 * again, because Screen Time's selection never leaves the phone it was made on
 * (ADR-0004). The screen says all three before "Continuar". Where the app goes then is
 * the root guard's call: a restored backup brings its finished onboarding with it.
 */
function resultLine(result: RestoreResult, copy: Strings['identity']['restoring']): string {
  switch (result) {
    case 'restored':
      return copy.restored;
    case 'circleOnly':
      return copy.circleOnly;
    case 'keyOnly':
      return copy.keyOnly;
    case 'unreadable':
      return copy.unreadable;
    case 'wrongKey':
      return copy.wrongKey;
    case 'offline':
      return copy.offline;
    case 'newerApp':
      return copy.newerApp;
    case 'noKeychain':
      return copy.noKeychain;
    case 'failed':
      return copy.failed;
  }
}

export default function RestoringScreen() {
  const router = useRouter();
  const t = useStrings();
  const copy = t.identity.restoring;
  const settings = useSettings();
  const target = useRestoreTarget((state) => state.credentials);
  const setTarget = useRestoreTarget((state) => state.setTarget);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  useBlockBack();

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // One run per attempt, even when an effect runs twice (React's development mode): a
  // second run would meet a secret the first one already rotated and say the key is wrong.
  const started = useRef(-1);
  useEffect(() => {
    if (target === null || started.current === attempt) {
      return;
    }
    started.current = attempt;
    void runRestore(target, Date.now()).then((outcome) => {
      if (restoreFinished(outcome)) {
        // The key is this phone's now; it does not stay in memory any longer than that.
        setTarget(null);
      }
      if (mounted.current) {
        setResult(outcome);
      }
    });
  }, [target, attempt, setTarget]);

  // Reached with no key (a cold launch that restored this route): there is nothing to run.
  const shown: RestoreResult | null = result ?? (target === null ? 'failed' : null);
  const running = shown === null;

  const onward = () => {
    // The guard decides the world: a restored backup brings a finished onboarding with
    // it; without one, the onboarding goes on from its first question.
    router.replace(settings.onboardingDone ? '/' : '/onboarding/goal');
  };

  const retry = () => {
    setResult(null);
    setAttempt((value) => value + 1);
  };

  let footer = <Button label={copy.working} onPress={() => undefined} busy busyLabel={copy.working} disabled />;
  if (shown !== null && restoreFinished(shown)) {
    footer = <Button label={copy.continue} onPress={onward} />;
  } else if (shown !== null && canRetry(shown) && target !== null) {
    footer = (
      <>
        <Button label={copy.retry} onPress={retry} />
        <Button label={t.common.back} variant="ghost" onPress={() => goBack(router)} />
      </>
    );
  } else if (shown !== null) {
    footer = (
      <>
        <Button label={copy.otherKey} onPress={() => router.replace('/restore/key')} />
        <Button label={t.common.back} variant="ghost" onPress={() => goBack(router)} />
      </>
    );
  }

  return (
    <Screen footer={footer}>
      <PageHeader title={copy.title} />
      <Stack gap="md">
        {running ? (
          <>
            <Text variant="heading">{copy.working}</Text>
            <StatusNote text={copy.workingNote} />
          </>
        ) : (
          <Text variant="heading" live>
            {resultLine(shown, copy)}
          </Text>
        )}
        {shown !== null && restoreFinished(shown) ? (
          <>
            <StatusNote text={copy.keyChanged} />
            <StatusNote text={copy.permissions} />
            {isIos && shown === 'restored' ? <StatusNote text={copy.iosApps} /> : null}
          </>
        ) : null}
      </Stack>
    </Screen>
  );
}
