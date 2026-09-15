import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { resetAndRehydrate, useSettings } from '../../data';
import { countText } from '../../data/modes';
import { Card, ListGroup, ListRow, PageHeader, Screen, Stack, Text } from '../../design/components';
import { formatBirthDate } from '../../lib/birthDate';

const VERSION = 'Versión 2026.9.1';

function onOff(flag: boolean): string {
  return flag ? 'Activadas' : 'Desactivadas';
}

/** 'Ninguna', '1 activa', '3 activas'. */
function activeRulesText(count: number): string {
  return count === 0 ? 'Ninguna' : countText(count, 'activa', 'activas');
}

/** 'Ninguno', '1 restante', '5 restantes'. */
function emergencyLeftText(left: number): string {
  return left === 0 ? 'Ninguno' : countText(left, 'restante', 'restantes');
}

/** The Ajustes tab: groups of rows that each open their own page, like Brick. */
export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();

  const activeRules = Object.values(settings.rules).filter(Boolean).length;

  const confirmReset = () => {
    Alert.alert('¿Borrar todo y reiniciar?', 'Modos, rutinas, sesiones y hábitos se pierden. No hay vuelta atrás.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar todo', style: 'destructive', onPress: () => resetAndRehydrate(Date.now()) },
    ]);
  };

  return (
    <Screen scroll inTabs>
      <PageHeader title="Ajustes" />

      <Card tone="muted">
        <Stack gap="xs">
          <Text variant="body">Este teléfono</Text>
          <Text variant="label" tone="secondary">
            Sin cuenta. Todo queda aquí.
          </Text>
        </Stack>
      </Card>

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
          value={emergencyLeftText(settings.emergencyLeft)}
          onPress={() => router.push('/settings/emergency')}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="clock"
          label="Actividades en vivo"
          value={onOff(settings.liveActivities)}
          onPress={() => router.push('/settings/live-activities')}
        />
        <ListRow
          icon="bell"
          label="Notificaciones"
          value={onOff(settings.notificationsAllowed)}
          onPress={() => router.push('/settings/notifications')}
        />
        <ListRow
          icon="heart"
          label="Salud"
          value={settings.healthConnected ? 'Conectada' : 'Sin conectar'}
          onPress={() => router.push('/settings/health')}
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          icon="calendar"
          label="Vida"
          value={settings.birthDate === null ? 'Sin fecha' : formatBirthDate(settings.birthDate)}
          onPress={() => router.push('/settings/life')}
        />
        <ListRow icon="help-circle" label="Centro de ayuda" onPress={() => router.push('/settings/help')} />
        <ListRow icon="info" label="Acerca de Vesper" onPress={() => router.push('/settings/about')} />
      </ListGroup>

      <Stack gap="sm">
        <ListGroup>
          <ListRow icon="trash-2" label="Borrar todo y reiniciar" tone="danger" kind="action" onPress={confirmReset} />
        </ListGroup>
        <Text variant="caption" tone="secondary">
          Modos, rutinas, sesiones y hábitos se pierden.
        </Text>
      </Stack>

      <Stack align="center" gap="xs">
        <Text variant="caption" weight="semibold">
          VESPER
        </Text>
        <Text variant="caption" tone="secondary">
          {VERSION}
        </Text>
      </Stack>
    </Screen>
  );
}
