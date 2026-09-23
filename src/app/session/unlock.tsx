import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { useFocusStore, useRunningSession } from '../../data';
import { useKeysStore } from '../../data/stores/keys';
import { Button, InkFlood, NativeHost, Screen, Spacer, Stack, Text } from '../../design/components';
import { KEY_EXIT_REASON } from '../../domain/key';
import { elapsed, plannedEndAt } from '../../domain/session';
import { useStrings } from '../../i18n';
import { useBlockBack } from '../../lib/useBlockBack';
import { CameraScanner } from '../../platform/CameraScanner';
import { requestPermission, status as cameraStatus } from '../../platform/camera';

/**
 * Scanning the key to end a session (ADR-0034), a full-screen route over the session
 * like the emergency, with no back gesture: the way out is the key or "Seguir
 * enfocado".
 *
 * Only the key that opened this session is accepted, and only a code from a later
 * window than the one that opened it — otherwise a single scan would start and end a
 * session in the same half minute. The session closes as `completed` when it had
 * already run its time and as `cancelled` when the key cut it short; either way the
 * reason says a key did it, so the ledger can tell this apart from giving up.
 */
export default function UnlockScreen() {
  const router = useRouter();
  useBlockBack();
  const t = useStrings();
  const session = useRunningSession();
  const verify = useKeysStore((state) => state.verify);
  const finish = useFocusStore((state) => state.finish);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leftRef = useRef(false);

  const camera = cameraStatus();

  if (session === null) {
    return null;
  }

  const ask = async () => {
    setAsked(true);
    const result = await requestPermission();
    if (result !== 'granted') {
      setError(cameraStatus().reason ?? t.keys.platform.denied);
    }
  };

  const onCode = async (text: string) => {
    if (leftRef.current) {
      return;
    }
    const now = Date.now();
    const verified = await verify(text, now, session.keyStep);
    if (verified === null) {
      // Telling these apart matters: one is the wrong key, the other is patience.
      const anyKey = await verify(text, now);
      setError(anyKey === null ? t.keys.session.wrongKey : t.keys.session.sameCode);
      return;
    }
    if (verified.keyId !== session.keyId) {
      setError(t.keys.session.wrongKey);
      return;
    }
    leftRef.current = true;
    setLeaving(true);
  };

  /** The page floods to paper; the session closes under it and `closed` shows the receipt. */
  const flooded = () => {
    const now = Date.now();
    const end = plannedEndAt(session);
    const ranItsTime = end !== null && now >= end;
    finish(ranItsTime ? 'completed' : 'cancelled', now, KEY_EXIT_REASON);
    router.replace({ pathname: '/session/closed', params: { key: '1', focusMs: String(elapsed(session, now)) } });
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.session.stayFocused} onPress={() => router.back()} />
          {camera.available || asked ? null : (
            <Button
              variant="ghost"
              label={t.keys.platform.permissionAsk}
              onPress={() => {
                void ask();
              }}
            />
          )}
        </>
      }
    >
      <Spacer />
      <Text variant="title">{t.keys.session.scanToEnd}</Text>

      {camera.available ? (
        <Stack gap="md">
          <NativeHost>
            <CameraScanner
              onCode={(text) => {
                void onCode(text);
              }}
            />
          </NativeHost>
          <Text variant="label" tone="secondary" align="center">
            {error ?? t.keys.session.locked}
          </Text>
        </Stack>
      ) : (
        <Text variant="label" tone="secondary">
          {error ?? camera.reason ?? t.keys.platform.permissionBody}
        </Text>
      )}

      <InkFlood active={leaving} tone="paper" onDone={flooded} />
    </Screen>
  );
}
