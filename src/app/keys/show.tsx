import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useKeys } from '../../data';
import { useKeysStore } from '../../data/stores/keys';
import { Button, KeyPattern, PageHeader, Screen, Stack, Text } from '../../design/components';
import { KEY_STEP_MS } from '../../domain/key';
import { useStrings } from '../../i18n';

/**
 * This phone acting as a key (ADR-0034): the code the other phone scans to start a
 * session and to end it.
 *
 * The code is redrawn when its 30 s window turns over. That is a clock, not an
 * animation: nothing fades, nothing moves, and any single frame is a whole code —
 * which is what a camera needs and what "Reducir movimiento" requires.
 */
export default function ShowKeyScreen() {
  const router = useRouter();
  const t = useStrings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const keys = useKeys();
  const codeFor = useKeysStore((state) => state.codeFor);
  const remove = useKeysStore((state) => state.remove);
  const [code, setCode] = useState<string | null>(null);

  const key = keys.find((entry) => entry.id === id) ?? null;

  useEffect(() => {
    if (key === null) {
      return;
    }
    let alive = true;
    const draw = () => {
      void codeFor(key.id, Date.now()).then((next) => {
        if (alive) {
          setCode(next);
        }
      });
    };
    draw();
    // Wake on the boundary itself, then every step, so the code on screen is never
    // one the scanner has already moved past.
    const toBoundary = KEY_STEP_MS - (Date.now() % KEY_STEP_MS);
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      draw();
      interval = setInterval(draw, KEY_STEP_MS);
    }, toBoundary);
    return () => {
      alive = false;
      clearTimeout(timeout);
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [key, codeFor]);

  return (
    <Screen
      scroll
      footer={
        key === null ? undefined : (
          <Button
            variant="ghost"
            label={t.keys.remove}
            onPress={() => {
              void remove(key.id).then(() => router.back());
            }}
          />
        )
      }
    >
      <PageHeader onBack={() => router.back()} title={key?.name ?? t.keys.title} />

      {key === null || code === null ? (
        <Text variant="label" tone="secondary" align="center">
          {t.keys.show.gone}
        </Text>
      ) : (
        <Stack gap="md">
          <Text variant="title">{t.keys.show.codeTitle}</Text>
          <KeyPattern value={code} accessibilityLabel={t.keys.show.codeTitle} />
          <Text variant="label" tone="secondary" align="center">
            {t.keys.show.codeHint}
          </Text>
          <Text variant="caption" tone="tertiary" align="center">
            {t.keys.removeConfirm}
          </Text>
        </Stack>
      )}
    </Screen>
  );
}
