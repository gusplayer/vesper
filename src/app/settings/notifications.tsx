import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

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
import { hasPermission, presentNow, requestPermission, status } from '../../platform/notifications';

/**
 * Notificaciones: the real OS permission first, then the switches for each kind of
 * notice, grouped like Brick. The switches do nothing until the permission exists;
 * the sync hook reads both.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const updateNotifications = useAppStore((state) => state.updateNotifications);

  const capability = status();
  const { notifications } = settings;
  const allowed = settings.notificationsAllowed;

  const [asking, setAsking] = useState(false);
  /** The OS said no. iOS will not ask again; only the system settings can flip it. */
  const [denied, setDenied] = useState(false);

  // The user can revoke the permission in the system settings behind our back. Keep
  // the flag honest, so the screen asks again instead of pretending.
  useEffect(() => {
    if (!allowed || !capability.available) {
      return;
    }
    let cancelled = false;
    void hasPermission().then((granted) => {
      if (!cancelled && !granted) {
        updateSettings({ notificationsAllowed: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, capability.available, updateSettings]);

  const allow = async () => {
    setAsking(true);
    const granted = await requestPermission();
    setAsking(false);
    if (granted) {
      setDenied(false);
      updateSettings({ notificationsAllowed: true });
    } else {
      setDenied(true);
    }
  };

  const tryNow = () => {
    void presentNow('Así se ve un aviso', 'Vesper te va a hablar así. Tocá para volver.');
  };

  return (
    <Screen
      scroll
      footer={
        allowed ? (
          <Button label="Probar ahora" variant="ghost" onPress={tryNow} />
        ) : (
          <Button
            label="Permitir notificaciones"
            onPress={() => void allow()}
            busy={asking}
            busyLabel="Pidiendo permiso…"
            disabled={!capability.available}
          />
        )
      }
    >
      <PageHeader onBack={() => router.back()} title="Notificaciones" />

      {!capability.available ? (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              Acá no hay notificaciones
            </Text>
            <Text variant="label" tone="secondary">
              {capability.reason}
            </Text>
          </Stack>
        </Card>
      ) : allowed ? null : denied ? (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              El permiso está apagado
            </Text>
            <Text variant="label" tone="secondary">
              El sistema no lo vuelve a pedir. Activalo en Ajustes del sistema › Vesper ›
              Notificaciones y volvé acá.
            </Text>
          </Stack>
        </Card>
      ) : (
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
          description="Aviso cuando empieza un horario"
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
          description="El domingo a las 20:00, cómo cerró la semana"
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
