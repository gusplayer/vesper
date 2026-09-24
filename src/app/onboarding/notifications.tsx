import { router } from 'expo-router';

import { goBack } from '../../lib/goBack';
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
import { requestPermission, status } from '../../platform/notifications';

/**
 * Notifications. Also the point where the mode must exist whether or not the user
 * made a routine, so the commit runs here if routine-set did not.
 *
 * "Allow" shows the real system prompt. A yes moves on; a no stays on the page and
 * says so, like Settings › Notifications does: the flag records what the OS said and
 * nothing blocks the flow. Where the capability is missing, or the OS has already
 * refused and will not ask again, the page says why in a card and the only button is
 * "Continuar" — there is no second prompt to offer.
 */
export default function NotificationsScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [asking, setAsking] = useState(false);
  /** The OS said no. iOS will not ask again; only the system settings can flip it. */
  const [denied, setDenied] = useState(false);
  const capability = status();

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
    if (granted) {
      next();
    } else {
      setDenied(true);
    }
  };
  const explained = !capability.available || denied;

  return (
    <Screen
      scroll
      footer={
        // Once there is no prompt left to show — the capability is missing, or the OS
        // already said no — asking again does nothing, so moving on becomes the primary
        // button instead of a dead one, the same swap Salud makes (rule 2). The why is
        // on the page above, in its own card.
        explained ? (
          <Button label={t.common.continue} onPress={next} />
        ) : (
          <>
            <Button label={copy.allow} onPress={() => void allow()} busy={asking} busyLabel={copy.asking} />
            <Button label={copy.notNow} variant="ghost" onPress={next} disabled={asking} />
          </>
        )
      }
    >
      <PageHeader onBack={() => goBack(router)} />
      <Text variant="caption" tone="tertiary" align="center">
        {copy.kicker}
      </Text>
      <Text variant="title" align="center">
        {copy.title}
      </Text>
      <Text variant="label" tone="secondary" align="center">
        {copy.subtitle}
      </Text>

      {!capability.available ? (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.settings.notifications.unavailableTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {capability.reason}
            </Text>
          </Stack>
        </Card>
      ) : denied ? (
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.settings.notifications.deniedTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.settings.notifications.deniedBody}
            </Text>
          </Stack>
        </Card>
      ) : null}

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
