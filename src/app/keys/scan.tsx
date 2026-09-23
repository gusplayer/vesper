import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { useActiveMode } from '../../data';
import { useKeysStore } from '../../data/stores/keys';
import { useFocusStore } from '../../data/stores/focus';
import { Button, NativeHost, PageHeader, Screen, Stack, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { CameraScanner } from '../../platform/CameraScanner';
import { requestPermission, status as cameraStatus } from '../../platform/camera';

/**
 * Scanning a key to start a session (ADR-0034).
 *
 * This is not a session route: no session is running yet, so it behaves like any other
 * page and the user can leave. Once the code is good, `startWithKey` records which key
 * and which 30 s window opened the session, and SessionGate does the navigating — the
 * same two lines the routine engine uses.
 */
export default function ScanKeyScreen() {
  const router = useRouter();
  const t = useStrings();
  const mode = useActiveMode();
  const verify = useKeysStore((state) => state.verify);
  const startWithKey = useFocusStore((state) => state.startWithKey);
  const [asked, setAsked] = useState(false);
  // One scan wins: a second read must not pop the route the session just pushed.
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const camera = cameraStatus();

  const ask = async () => {
    setAsked(true);
    const result = await requestPermission();
    if (result !== 'granted') {
      setError(cameraStatus().reason ?? t.keys.platform.denied);
    }
  };

  const onCode = async (text: string) => {
    if (startedRef.current) {
      return;
    }
    if (mode === null) {
      setError(t.keys.session.noMode);
      return;
    }
    const now = Date.now();
    const verified = await verify(text, now);
    if (verified === null) {
      setError(t.keys.session.wrongKey);
      return;
    }
    startedRef.current = true;
    startWithKey(mode.id, now, { id: verified.keyId, step: verified.step });
    // SessionGate pulls the app into the session; this page must not be behind it.
    router.back();
  };

  return (
    <Screen
      scroll
      footer={
        camera.available || asked ? undefined : (
          <Button
            label={t.keys.platform.permissionAsk}
            onPress={() => {
              void ask();
            }}
          />
        )
      }
    >
      <PageHeader onBack={() => router.back()} title={t.keys.session.scanToStart} />

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
            {error ?? t.keys.session.startHint}
          </Text>
        </Stack>
      ) : (
        <Stack gap="xs">
          <Text variant="body" weight="medium">
            {t.keys.platform.permissionTitle}
          </Text>
          <Text variant="label" tone="secondary">
            {error ?? camera.reason ?? t.keys.platform.permissionBody}
          </Text>
        </Stack>
      )}
    </Screen>
  );
}
