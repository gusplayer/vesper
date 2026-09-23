import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useKeysStore } from '../../data/stores/keys';
import {
  Button,
  Card,
  FieldRow,
  KeyPattern,
  NativeHost,
  PageHeader,
  Screen,
  Stack,
  Text,
} from '../../design/components';
import { useStrings } from '../../i18n';
import { CameraScanner } from '../../platform/CameraScanner';
import { requestPermission, status as cameraStatus } from '../../platform/camera';

type Step = 'choose' | 'showing' | 'scanning' | 'naming';

/**
 * Pairing a key (ADR-0034). One of the two phones holds the key and the other uses it,
 * so the first question is which one this is.
 *
 * Holding it: this phone invents the secret, keeps it in the keychain and shows it once
 * for the other to read. Using it: this phone reads that code and keeps the same secret.
 * From then on both derive the same rotating code and neither needs the network again.
 */
export default function PairKeyScreen() {
  const router = useRouter();
  const t = useStrings();
  const [step, setStep] = useState<Step>('choose');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createAsKey = useKeysStore((state) => state.createAsKey);
  const pairFromCode = useKeysStore((state) => state.pairFromCode);
  const camera = cameraStatus();

  const beKey = async () => {
    const created = await createAsKey(t.keys.defaultName, Date.now());
    if (!created.ok) {
      setError(created.reason === 'noKeychain' ? t.keys.pair.noKeychain : t.keys.pair.full);
      return;
    }
    setPairingCode(created.code);
    setStep('showing');
  };

  const startScan = async () => {
    const result = await requestPermission();
    if (result !== 'granted') {
      setError(cameraStatus().reason ?? t.keys.platform.denied);
      return;
    }
    setError(null);
    setStep('scanning');
  };

  const save = async () => {
    if (scanned === null) {
      return;
    }
    const outcome = await pairFromCode(scanned, name.trim() || t.keys.namePlaceholder, Date.now());
    if (outcome === 'ok') {
      router.back();
      return;
    }
    setError(
      outcome === 'full' ? t.keys.pair.full : outcome === 'noKeychain' ? t.keys.pair.noKeychain : t.keys.pair.badCode,
    );
    setStep('scanning');
  };

  return (
    <Screen
      scroll
      footer={
        step === 'showing' ? (
          <Button label={t.keys.show.done} onPress={() => router.back()} />
        ) : step === 'naming' ? (
          <Button
            label={t.keys.pair.save}
            onPress={() => {
              void save();
            }}
          />
        ) : undefined
      }
    >
      <PageHeader onBack={() => router.back()} title={t.keys.title} />

      {step === 'choose' ? (
        <>
          <Text variant="title">{t.keys.choose.title}</Text>
          <Card
            onPress={() => {
              void beKey();
            }}
            accessibilityLabel={t.keys.choose.isKey}
          >
            <Stack gap="xs">
              <Text variant="body" weight="medium">
                {t.keys.choose.isKey}
              </Text>
              <Text variant="label" tone="secondary">
                {t.keys.choose.isKeyHint}
              </Text>
            </Stack>
          </Card>
          <Card
            onPress={() => {
              void startScan();
            }}
            accessibilityLabel={t.keys.choose.usesKey}
          >
            <Stack gap="xs">
              <Text variant="body" weight="medium">
                {t.keys.choose.usesKey}
              </Text>
              <Text variant="label" tone="secondary">
                {t.keys.choose.usesKeyHint}
              </Text>
            </Stack>
          </Card>
        </>
      ) : null}

      {step === 'showing' && pairingCode !== null ? (
        <>
          <Text variant="title">{t.keys.show.title}</Text>
          <KeyPattern value={pairingCode} accessibilityLabel={t.keys.show.title} />
          <Text variant="label" tone="secondary" align="center">
            {t.keys.show.hint}
          </Text>
        </>
      ) : null}

      {step === 'scanning' ? (
        <>
          <Text variant="title">{t.keys.pair.title}</Text>
          <NativeHost>
            <CameraScanner
              onCode={(text) => {
                setScanned(text);
                setError(null);
                setStep('naming');
              }}
            />
          </NativeHost>
          <Text variant="label" tone="secondary" align="center">
            {camera.available ? t.keys.pair.hint : (camera.reason ?? '')}
          </Text>
        </>
      ) : null}

      {step === 'naming' ? (
        <>
          <Text variant="title">{t.keys.pair.named}</Text>
          <FieldRow
            label={t.keys.nameLabel}
            value={name}
            onChangeText={setName}
            placeholder={t.keys.namePlaceholder}
          />
        </>
      ) : null}

      {error !== null ? (
        <Text variant="label" tone="secondary" align="center">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
