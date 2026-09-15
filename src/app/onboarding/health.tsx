import { router } from 'expo-router';
import { useState } from 'react';

import { useAppStore } from '../../data';
import { Button, Text } from '../../design/components';
import { PermissionPage, type PermissionBlock } from '../../features/onboarding/PermissionPage';
import { requestAuthorization, status } from '../../platform/health';

const BLOCKS: ReadonlyArray<PermissionBlock> = [
  {
    icon: 'activity',
    heading: 'Hábitos que se marcan solos',
    body: 'Gym, pasos y sueño se confirman con Salud. No tienes que tocar nada.',
  },
  {
    icon: 'lock',
    heading: 'Nunca sale del teléfono',
    body: 'Lo que Salud comparte se lee aquí y no va a ningún servidor.',
  },
  {
    icon: 'heart',
    heading: 'Verificado, no declarado',
    body: 'Lo que Salud confirma vale distinto de lo que declarás. Nunca se suman.',
  },
];

/**
 * Health. Optional: "Ahora no" moves on without flipping the flag. Where Health does
 * not exist (Android, an iPad, a build without it) the only button moves on and the
 * line under it says why.
 */
export default function HealthScreen() {
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [busy, setBusy] = useState(false);

  const health = status();

  const next = () => router.push('/onboarding/routine');

  const connect = async () => {
    setBusy(true);
    const granted = await requestAuthorization();
    setBusy(false);
    if (granted) {
      updateSettings({ healthConnected: true });
    }
    next();
  };

  return (
    <PermissionPage
      title="Conecta Salud"
      blocks={BLOCKS}
      onBack={() => router.back()}
      footer={
        health.available ? (
          <>
            <Button
              label="Conectar Salud"
              onPress={() => void connect()}
              busy={busy}
              busyLabel="Conectando…"
            />
            <Button label="Ahora no" variant="ghost" onPress={next} />
          </>
        ) : (
          <>
            <Button label="Continuar sin Salud" onPress={next} />
            <Text variant="caption" tone="tertiary" align="center">
              {health.reason}
            </Text>
          </>
        )
      }
    />
  );
}
