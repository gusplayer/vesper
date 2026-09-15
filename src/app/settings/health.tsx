import { useRouter } from 'expo-router';

import { HEALTH, useAppStore, useSettings } from '../../data';
import {
  Button,
  Icon,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Stack,
  Text,
  type IconName,
} from '../../design/components';
import { durationText } from '../../lib/format';

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
    text: 'Los hábitos verificados se marcan solos: gym, pasos, sueño. Vos no tocás nada.',
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

/** Salud: the pitch and a connect button, or the week's summary and a way out. */
export default function HealthScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);

  const connected = settings.healthConnected;

  return (
    <Screen
      scroll
      footer={
        connected ? undefined : (
          <>
            <Button label="Conectar Salud" onPress={() => updateSettings({ healthConnected: true })} />
            <Text variant="caption" tone="tertiary" align="center">
              En el prototipo esto no pide permiso de verdad.
            </Text>
          </>
        )
      }
    >
      <PageHeader onBack={() => router.back()} title="Salud" />

      {connected ? (
        <>
          <ListGroup title="esta semana">
            <ListRow label="Entrenamientos esta semana" value={String(HEALTH.workoutsThisWeek)} />
            <ListRow label="Pasos hoy" value={HEALTH.stepsToday.toLocaleString('es-CO')} />
            <ListRow label="Sueño anoche" value={durationText(HEALTH.sleepLastNightMs)} />
          </ListGroup>
          <Text variant="caption" tone="tertiary" align="center">
            Datos de ejemplo. Nada de esto viene de Salud todavía.
          </Text>
          <Button
            label="Desconectar"
            variant="ghost"
            onPress={() => updateSettings({ healthConnected: false })}
          />
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
