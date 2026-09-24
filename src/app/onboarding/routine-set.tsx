import { router } from 'expo-router';

import { goBack } from '../../lib/goBack';

import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, Card, PageHeader, Screen, Stack, Text, Toggle } from '../../design/components';
import { commitOnboarding } from '../../features/onboarding/commit';
import { windowText } from '../../features/schedules/format';
import { useStrings } from '../../i18n';

/** A preview of the schedule card as the Routines tab will show it, then save. */
export default function RoutineSetScreen() {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const schedule = useOnboardingDraft((state) => state.schedule);

  const copy = t.onboarding.routineSet;

  const save = () => {
    commitOnboarding({ withSchedule: true });
    router.push('/onboarding/notifications');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={copy.save} onPress={save} />
          <Button label={copy.edit} variant="ghost" onPress={() => goBack(router)} />
        </>
      }
    >
      <PageHeader onBack={() => goBack(router)} />

      <Card>
        <Stack direction="row" align="center" justify="space-between" gap="md">
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {copy.cardTitle(modeName)}
            </Text>
            <Text variant="label" tone="secondary">
              {windowText(schedule, t.format)}
            </Text>
            <Text variant="label" tone="secondary">
              {copy.modeLine(modeName)}
            </Text>
          </Stack>
          {/* A preview: the toggle is drawn on and does nothing yet. */}
          <Toggle value onValueChange={() => undefined} accessibilityLabel={copy.activeLabel} />
        </Stack>
      </Card>

      <Text variant="title">{copy.title}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>
    </Screen>
  );
}
