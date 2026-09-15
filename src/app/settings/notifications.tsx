import { useRouter } from 'expo-router';

import { useAppStore, useSettings } from '../../data';
import {
  Button,
  Card,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Stack,
  Text,
  Toggle,
} from '../../design/components';

/**
 * Notificaciones: the permission first (a flag in the prototype), then the switches
 * for each kind of notice, grouped like Brick.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const updateNotifications = useAppStore((state) => state.updateNotifications);

  const { notifications } = settings;
  const allowed = settings.notificationsAllowed;

  return (
    <Screen
      scroll
      footer={
        allowed ? undefined : (
          <>
            <Button
              label="Permitir notificaciones"
              onPress={() => updateSettings({ notificationsAllowed: true })}
            />
            <Text variant="caption" tone="tertiary" align="center">
              En el prototipo esto no pide permiso de verdad.
            </Text>
          </>
        )
      }
    >
      <PageHeader onBack={() => router.back()} title="Notificaciones" />

      {allowed ? null : (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              Vesper todavía no puede avisarte
            </Text>
            <Text variant="label" tone="secondary">
              Sin permiso no hay aviso al terminar una sesión ni cierre semanal. Se pide una sola vez.
            </Text>
          </Stack>
        </Card>
      )}

      <ListGroup title="general">
        <ListRow
          label="Acompañamiento"
          description="Recordatorios y chequeos para sostener el hábito"
          right={
            <Toggle
              value={notifications.coaching}
              onValueChange={(coaching) => updateNotifications({ coaching })}
              accessibilityLabel="Acompañamiento"
            />
          }
        />
        <ListRow
          label="Fin de sesión"
          description="Aviso cuando el timer termina"
          right={
            <Toggle
              value={notifications.sessionEnd}
              onValueChange={(sessionEnd) => updateNotifications({ sessionEnd })}
              accessibilityLabel="Fin de sesión"
            />
          }
        />
        <ListRow
          label="Cierre semanal"
          description="El domingo, cómo cerró la semana"
          right={
            <Toggle
              value={notifications.weeklyClose}
              onValueChange={(weeklyClose) => updateNotifications({ weeklyClose })}
              accessibilityLabel="Cierre semanal"
            />
          }
        />
      </ListGroup>

      <ListGroup title="sistema">
        <ListRow
          label="Novedades importantes"
          description="Cambios que vale la pena saber"
          right={
            <Toggle
              value={notifications.updates}
              onValueChange={(updates) => updateNotifications({ updates })}
              accessibilityLabel="Novedades importantes"
            />
          }
        />
      </ListGroup>
    </Screen>
  );
}
