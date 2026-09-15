import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { resetAndRehydrate, useLife, useSettings } from '../../data';
import { ListGroup, ListRow, PageHeader, Screen, Stack, Text } from '../../design/components';
import { useNow } from '../../lib/useNow';

const VERSION = 'Versión 2026.9.1';

/** The life counter only needs to move once a minute. */
const CLOCK_MS = 60_000;

function yesNo(flag: boolean): string {
  return flag ? 'Sí' : 'No';
}

function activeRulesText(count: number): string {
  return count === 1 ? '1 activa' : `${count} activas`;
}

/** The Ajustes tab: groups of rows that each open their own page, like Brick. */
export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const now = useNow(CLOCK_MS);
  const life = useLife(now);

  const activeRules = Object.values(settings.rules).filter(Boolean).length;

  const confirmReset = () => {
    Alert.alert('¿Borrar todo y reiniciar?', 'Modos, horarios, sesiones y hábitos se pierden. No hay vuelta atrás.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todo', style: 'destructive', onPress: () => resetAndRehydrate(Date.now()) },
    ]);
  };

  return (
    <Screen scroll inTabs>
      <PageHeader title="Ajustes" />

      <ListGroup>
        <ListRow icon="smartphone" label="Este teléfono" description="Sin cuenta. Todo queda aquí." />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="edit-3"
          label="Mis reglas"
          value={activeRulesText(activeRules)}
          onPress={() => router.push('/settings/rules')}
        />
        <ListRow
          icon="unlock"
          label="Desbloqueo de emergencia"
          value={String(settings.emergencyLeft)}
          onPress={() => router.push('/settings/emergency')}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="clock"
          label="Live Activities"
          value={yesNo(settings.liveActivities)}
          onPress={() => router.push('/settings/live-activities')}
        />
        <ListRow
          icon="bell"
          label="Notificaciones"
          value={yesNo(settings.notificationsAllowed)}
          onPress={() => router.push('/settings/notifications')}
        />
        <ListRow
          icon="heart"
          label="Salud"
          value={settings.healthConnected ? 'Conectada' : 'No'}
          onPress={() => router.push('/settings/health')}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="calendar"
          label="Vida"
          value={life === null ? 'Sin fecha' : `${life.left} semanas`}
          onPress={() => router.push('/settings/life')}
        />
        <ListRow icon="help-circle" label="Centro de ayuda" onPress={() => router.push('/settings/help')} />
        <ListRow icon="info" label="Acerca de Vesper" onPress={() => router.push('/settings/about')} />
        <ListRow icon="trash-2" label="Borrar todo y reiniciar" tone="danger" onPress={confirmReset} />
      </ListGroup>

      <Stack align="center" gap="xs">
        <Text variant="caption" weight="semibold">
          VESPER
        </Text>
        <Text variant="caption" tone="tertiary">
          {VERSION}
        </Text>
        <Text variant="caption" tone="tertiary">
          Términos · Privacidad
        </Text>
      </Stack>
    </Screen>
  );
}
