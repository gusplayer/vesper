import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAppStore } from '../../data';
import {
  Button,
  Card,
  IconCircle,
  PageHeader,
  Screen,
  Stack,
  Text,
} from '../../design/components';
import { commitOnboarding } from '../../features/onboarding/commit';
import { useStrings } from '../../i18n';
import { requestPermission } from '../../platform/notifications';

/**
 * Notifications. Also the point where the mode must exist whether or not the user
 * made a routine, so the commit runs here if routine-set did not.
 *
 * "Allow" shows the real system prompt and moves on whatever the answer: the
 * flag records what the OS said, and Settings › Notifications can retry later.
 */
export default function NotificationsScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    commitOnboarding({ withSchedule: false });
  }, []);

  const copy = t.onboarding.notifications;
  const next = () => router.push('/onboarding/tour');

  const allow = async () => {
    setAsking(true);
    const granted = await requestPermission();
    setAsking(false);
    updateSettings({ notificationsAllowed: granted });
    next();
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={copy.allow} onPress={() => void allow()} busy={asking} busyLabel={copy.asking} />
          <Button label={copy.notNow} variant="ghost" onPress={next} disabled={asking} />
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="caption" tone="tertiary" align="center">
        {copy.kicker}
      </Text>
      <Text variant="title" align="center">
        {copy.title}
      </Text>
      <Text variant="label" tone="secondary" align="center">
        {copy.subtitle}
      </Text>

      {/* A fake notification, the way one would land on the lock screen. */}
      <Card>
        <Stack direction="row" align="flex-start" gap="md">
          <IconCircle name="clock" />
          <Stack grow gap="xs">
            <Text variant="body" weight="medium">
              {copy.preview.title}
            </Text>
            <Text variant="label" tone="secondary">
              {copy.preview.body}
            </Text>
          </Stack>
          <Text variant="caption" tone="tertiary">
            {copy.preview.when}
          </Text>
        </Stack>
      </Card>
    </Screen>
  );
}
