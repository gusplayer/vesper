import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAppStore, useSettings } from '../../data';
import {
  Button,
  Icon,
  PageHeader,
  Screen,
  Stack,
  Text,
  type IconName,
} from '../../design/components';
import { HealthWeekSummary } from '../../features/health/HealthWeekSummary';
import { requestAuthorization, status } from '../../platform/health';
import { syncHealth } from '../../platform/hooks/useHealthSync';

type Block = {
  icon: IconName;
  title: string;
  text: string;
};

/** Three blocks, like Brick's Screen Time page: what it does, what it keeps, why. */
const BLOCKS: Block[] = [
  {
    icon: 'activity',
    title: 'Cómo lo usás',
    text: 'Los hábitos verificados se marcan solos: gym, pasos, sueño. Tú no tocas nada.',
  },
  {
    icon: 'lock',
    title: 'Cómo lo usamos',
    text: 'Lo que Salud comparte nunca sale del teléfono. No hay cuenta ni servidor.',
  },
  {
    icon: 'heart',
    title: 'Por qué importa',
    text: 'Un hábito que se marca solo no se discute. Lo verificado y lo declarado nunca se suman.',
  },
];

const DENIED_TEXT = 'Salud no dio permiso. Puedes intentarlo de nuevo desde aquí.';

/**
 * Salud: the pitch and a connect button, or the week's summary and a way out.
 * Connecting asks HealthKit for real; when Health is not available here the button
 * is disabled and the line under it says why.
 */
export default function HealthScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setHealthMarks = useAppStore((state) => state.setHealthMarks);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const health = status();
  const connected = settings.healthConnected;

  const connect = async () => {
    setBusy(true);
    setDenied(false);
    const granted = await requestAuthorization();
    setBusy(false);
    if (!granted) {
      setDenied(true);
      return;
    }
    updateSettings({ healthConnected: true });
    void syncHealth(true);
  };

  const disconnect = () => {
    setHealthMarks([], Date.now());
    updateSettings({ healthConnected: false, healthSyncedAt: null });
  };

  const caption = health.reason ?? (denied ? DENIED_TEXT : null);

  return (
    <Screen
      scroll
      footer={
        connected ? undefined : (
          <>
            <Button
              label="Conectar Salud"
              onPress={() => void connect()}
              disabled={!health.available}
              busy={busy}
              busyLabel="Conectando…"
            />
            {caption === null ? null : (
              <Text variant="caption" tone="tertiary" align="center">
                {caption}
              </Text>
            )}
          </>
        )
      }
    >
      <PageHeader onBack={() => router.back()} title="Salud" />

      {connected ? (
        <>
          <HealthWeekSummary now={Date.now()} onSyncNow={() => void syncHealth(true)} />
          <Text variant="caption" tone="tertiary" align="center">
            Salud se lee al abrir la app y cada 15 minutos. Nada sale del teléfono.
          </Text>
          <Button label="Desconectar" variant="ghost" onPress={disconnect} />
        </>
      ) : (
        <Stack gap="xxl">
          {BLOCKS.map((block) => (
            <Stack key={block.title} direction="row" align="flex-start" gap="lg">
              <Icon name={block.icon} size="lg" />
              <Stack grow gap="xs">
                <Text variant="heading">{block.title}</Text>
                <Text variant="label" tone="secondary">
                  {block.text}
                </Text>
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Screen>
  );
}
