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
import { useStrings } from '../../i18n';
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
  const t = useStrings();
  const page = t.settings.notifications;

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
    void presentNow(t.notifications.test.title, t.notifications.test.body);
  };

  return (
    <Screen
      scroll
      footer={
        allowed ? (
          <Button label={page.tryNow} variant="ghost" onPress={tryNow} />
        ) : (
          <Button
            label={page.allow}
            onPress={() => void allow()}
            busy={asking}
            busyLabel={page.asking}
            disabled={!capability.available}
          />
        )
      }
    >
      <PageHeader onBack={() => router.back()} title={page.title} />

      {!capability.available ? (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {page.unavailableTitle}
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
              {page.deniedTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {page.deniedBody}
            </Text>
          </Stack>
        </Card>
      ) : (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {page.pendingTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {page.pendingBody}
            </Text>
          </Stack>
        </Card>
      )}

      <ListGroup title={page.generalGroup}>
        <ListRow
          label={page.coaching.label}
          description={page.coaching.description}
          right={
            <Toggle
              value={notifications.coaching}
              onValueChange={(coaching) => updateNotifications({ coaching })}
              accessibilityLabel={page.coaching.label}
            />
          }
        />
        <ListRow
          label={page.sessionEnd.label}
          description={page.sessionEnd.description}
          right={
            <Toggle
              value={notifications.sessionEnd}
              onValueChange={(sessionEnd) => updateNotifications({ sessionEnd })}
              accessibilityLabel={page.sessionEnd.label}
            />
          }
        />
        <ListRow
          label={page.weeklyClose.label}
          description={page.weeklyClose.description}
          right={
            <Toggle
              value={notifications.weeklyClose}
              onValueChange={(weeklyClose) => updateNotifications({ weeklyClose })}
              accessibilityLabel={page.weeklyClose.label}
            />
          }
        />
      </ListGroup>

      <ListGroup title={page.systemGroup}>
        <ListRow
          label={page.updates.label}
          description={page.updates.description}
          right={
            <Toggle
              value={notifications.updates}
              onValueChange={(updates) => updateNotifications({ updates })}
              accessibilityLabel={page.updates.label}
            />
          }
        />
      </ListGroup>
    </Screen>
  );
}
