import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { useAppStore, useSettings } from '../../data';
import { Button, ListGroup, ListRow, NoticeCard, PageHeader, Screen, Toggle } from '../../design/components';
import type { NotificationPrefs } from '../../data/types';
import { ReminderTimeSheet, reminderTimeText } from '../../features/settings/ReminderTimeSheet';
import { useStrings } from '../../i18n';
import { presentNow, requestPermission, status } from '../../platform/notifications';
import { reconcileNotificationPermission } from '../../platform/hooks/useNotificationSync';

type SwitchKey = Exclude<keyof NotificationPrefs, 'reminderMinutes' | 'updates'>;
type GroupTitle = 'generalGroup' | 'dailyGroup' | 'circleGroup';

/**
 * The switches, grouped like Brick. "Cada día" also holds the hour row and the budget
 * footer. `updates` has no row: no notice of that kind exists, and a switch that
 * controls nothing is a flag passed off as a capability.
 */
const GROUPS: readonly { title: GroupTitle; rows: readonly SwitchKey[] }[] = [
  { title: 'generalGroup', rows: ['coaching', 'sessionEnd', 'weeklyClose'] },
  { title: 'dailyGroup', rows: ['streak', 'noFocus', 'reactivation', 'challenges'] },
  { title: 'circleGroup', rows: ['nudges'] },
];

/**
 * Notificaciones: the real OS permission first, then the switches for each kind of
 * notice, grouped like Brick: general, the daily ones with their hour (ADR-0027), and
 * the circle. The switches are dimmed and cannot move until the permission exists: a
 * switch that looks live while nothing can be shown would pass for a capability.
 *
 * The permission lives in the system settings. The page reads it on opening and on
 * every return to the foreground, so a permission turned on or off there shows here
 * without a tap. Once the system will not ask again (`blocked`), the only way left is
 * the system settings, and the primary button goes there.
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
  /**
   * The system said no and will not ask again (iOS after the first no, Android after
   * the second). Read from the system, not remembered: leaving the page and coming
   * back still knows.
   */
  const [blocked, setBlocked] = useState(false);
  const [choosingTime, setChoosingTime] = useState(false);

  // The user can turn the permission on or off in the system settings behind our back.
  // Read it now and on every return, so the flag and this page say what the system says.
  useEffect(() => {
    if (!capability.available) {
      return;
    }
    let cancelled = false;
    const read = () => {
      void reconcileNotificationPermission().then((state) => {
        if (!cancelled) {
          setBlocked(state === 'blocked');
        }
      });
    };
    read();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        read();
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [capability.available]);

  const allow = async () => {
    setAsking(true);
    const granted = await requestPermission();
    setAsking(false);
    if (granted) {
      updateSettings({ notificationsAllowed: true });
    }
    const state = await reconcileNotificationPermission();
    setBlocked(state === 'blocked');
  };

  const openSystemSettings = () => {
    void Linking.openSettings();
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
        ) : blocked && capability.available ? (
          <Button label={page.openSettings} onPress={openSystemSettings} />
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
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={page.title} />

      {!capability.available ? (
        <NoticeCard title={page.unavailableTitle} body={capability.reason ?? undefined} />
      ) : allowed ? null : blocked ? (
        <NoticeCard title={page.deniedTitle} body={page.deniedBody} />
      ) : (
        <NoticeCard title={page.pendingTitle} body={page.pendingBody} />
      )}

      {GROUPS.map((group) => (
        <ListGroup
          key={group.title}
          title={page[group.title]}
          footer={group.title === 'dailyGroup' ? page.dailyCaption : undefined}
        >
          {group.rows.map((key) => (
            <ListRow
              key={key}
              label={page[key].label}
              description={page[key].description}
              right={
                <Toggle
                  value={notifications[key]}
                  onValueChange={(value) => updateNotifications({ [key]: value })}
                  accessibilityLabel={page[key].label}
                  accessibilityHint={page[key].description}
                  disabled={!allowed}
                />
              }
            />
          ))}
          {group.title === 'dailyGroup' ? (
            <ListRow
              label={page.reminderTime.label}
              value={reminderTimeText(notifications.reminderMinutes)}
              onPress={() => setChoosingTime(true)}
              disabled={!allowed}
            />
          ) : null}
        </ListGroup>
      ))}

      <ReminderTimeSheet
        visible={choosingTime}
        value={notifications.reminderMinutes}
        onChange={(reminderMinutes) => updateNotifications({ reminderMinutes })}
        onClose={() => setChoosingTime(false)}
      />
    </Screen>
  );
}
