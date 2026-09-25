import { router } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { useAppStore } from '../../data';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, Card, IconCircle, NoticeCard, PageHeader, Screen, Stack, StatusNote, Text } from '../../design/components';
import { commitOnboarding } from '../../features/onboarding/commit';
import { stepProgress } from '../../features/onboarding/steps';
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
 *
 * The sample on the page is a notification Vesper really sends: the routine's
 * reminder when one was saved, the day-without-focus one otherwise. Under it, the
 * budget of ADR-0027, so the user knows how little they are allowing.
 */
export default function NotificationsScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const modeName = useOnboardingDraft((state) => state.modeName);
  const hasRoutine = useOnboardingDraft((state) => state.scheduleId !== null);
  const [asking, setAsking] = useState(false);
  /** The OS said no. iOS will not ask again; only the system settings can flip it. */
  const [denied, setDenied] = useState(false);
  const capability = status();

  useEffect(() => {
    commitOnboarding({ withSchedule: false });
  }, []);

  const copy = t.onboarding.notifications;
  const next = () => router.push('/onboarding/tour');
  // The schedule is named after the mode (commit.ts), so its reminder reads the same.
  const sample = hasRoutine
    ? { title: t.notifications.schedule.title(modeName), body: t.notifications.schedule.body(modeName) }
    : { title: t.notifications.noFocus.title, body: t.notifications.noFocus.body };

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
        // on the page above, in its own card, which after a no also carries the way to
        // the system's Settings.
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
      <PageHeader onBack={() => goBack(router)} progress={stepProgress('notifications', t.onboarding.progress)} />
      <Text variant="title">{copy.title}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>

      {!capability.available ? (
        <NoticeCard icon="bell-off" title={t.settings.notifications.unavailableTitle} body={capability.reason ?? undefined} />
      ) : denied ? (
        <NoticeCard
          icon="bell-off"
          title={t.settings.notifications.deniedTitle}
          body={t.settings.notifications.deniedBody}
          actionLabel={copy.openSettings}
          onAction={() => void Linking.openSettings()}
        />
      ) : null}

      {/* A real notification, the way one would land on the lock screen. */}
      <Card>
        <Stack direction="row" align="flex-start" gap="md">
          <IconCircle name="clock" />
          <Stack grow gap="xs">
            <Text variant="body" weight="medium">
              {sample.title}
            </Text>
            <Text variant="label" tone="secondary">
              {sample.body}
            </Text>
          </Stack>
          <Text variant="caption" tone="secondary">
            {copy.preview.when}
          </Text>
        </Stack>
      </Card>
      <StatusNote text={copy.budget} />
    </Screen>
  );
}
