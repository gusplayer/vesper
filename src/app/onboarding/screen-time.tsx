import { router } from 'expo-router';
import { useState } from 'react';

import { useAppStore } from '../../data';
import { Button, Text } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { requestAuthorization, status as blockingStatus } from '../../platform/blocking';

const BLOCKS: ReadonlyArray<PermissionBlock> = [
  {
    icon: 'settings',
    heading: 'Cómo lo vas a usar',
    body: 'Con el acceso elegís qué apps bloquear en tus modos. Tiempo de uso las pausa mientras estás enfocado.',
  },
  {
    icon: 'lock',
    heading: 'Cómo lo usamos',
    body: 'Nunca vemos qué apps bloqueas ni tu historial. Todo queda en tu teléfono.',
  },
  {
    icon: 'zap',
    heading: 'Por qué importa',
    body: 'Así Vesper te ayuda a crear tiempo con intención, sin borrar apps.',
  },
];

/**
 * Screen Time. "Permitir acceso" asks iOS for real; approval flips
 * `screenTimeConnected`. Where the capability is missing, or when it says no, the
 * onboarding goes on anyway and the caption says why.
 */
export default function ScreenTimeScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [reason, setReason] = useState<string | null>(blockingStatus().reason);
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    const result = await requestAuthorization();
    setBusy(false);
    if (result === 'approved') {
      updateSettings({ screenTimeConnected: true });
    } else {
      setReason(blockingStatus().reason ?? 'No se pudo conectar Tiempo de uso');
    }
    router.push('/onboarding/health');
  };

  return (
    <PermissionPage
      title="Conecta Vesper a Tiempo de uso"
      blocks={BLOCKS}
      onBack={() => router.back()}
      footer={
        <>
          <Button label="Permitir acceso" busyLabel="Pidiendo…" busy={busy} onPress={() => void allow()} />
          <Text variant="caption" tone="tertiary" align="center">
            {reason === null
              ? 'iOS te va a pedir confirmar. Puedes cambiarlo después en Ajustes.'
              : `Puedes seguir sin esto: ${reason}.`}
          </Text>
        </>
      }
    />
  );
}
