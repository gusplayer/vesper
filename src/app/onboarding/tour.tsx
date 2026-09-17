import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { useAppStore, useSettings } from '../../data';
import {
  Button,
  Card,
  HeroObject,
  IconCircle,
  ListGroup,
  ListRow,
  ProgressDots,
  Screen,
  Stack,
  Text,
 ThemeScope } from '../../design/components';
import { useStrings, type Strings } from '../../i18n';

type Step = {
  preview: ReactNode;
  title: string;
  body: string;
};

/** The three pages, built from the dictionary so they follow a language change. */
function tourSteps(t: Strings['onboarding']['tour'], emergencyTotal: number): readonly Step[] {
  return [
    {
      preview: (
        <Stack align="center" gap="md">
          <HeroObject size="md" />
          <Text variant="caption" tone="secondary">
            {t.focus.caption}
          </Text>
        </Stack>
      ),
      title: t.focus.title,
      body: t.focus.body,
    },
    {
      preview: (
        <ListGroup>
          <ListRow label={t.emergency.rules} />
          <ListRow label={t.emergency.unlocks} value={String(emergencyTotal)} />
        </ListGroup>
      ),
      title: t.emergency.title,
      body: t.emergency.body,
    },
    {
      preview: (
        <Stack align="center" gap="md">
          <HeroObject size="md" />
          <Text variant="caption" tone="secondary">
            {t.local.caption}
          </Text>
        </Stack>
      ),
      title: t.local.title,
      body: t.local.body,
    },
  ];
}

/** Three dark pages with a preview each. The last one ends the onboarding. */
export default function TourScreen() {
  const t = useStrings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const emergencyTotal = useSettings().emergencyTotal;
  const [index, setIndex] = useState(0);

  const steps = tourSteps(t.onboarding.tour, emergencyTotal);
  const step = steps[index] ?? steps[0];
  const last = index === steps.length - 1;

  const next = () => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    // The root guard swaps to the tabs on its own; the replace is there for safety.
    updateSettings({ onboardingDone: true });
    router.replace('/(tabs)');
  };

  if (step === undefined) {
    return null;
  }

  return (
    <ThemeScope scheme="dark">
      <Screen
        footer={
          <Stack direction="row" align="center" gap="md">
            {index > 0 ? (
              <IconCircle
                name="arrow-left"
                tone="card"
                onPress={() => setIndex(index - 1)}
                accessibilityLabel={t.onboarding.tour.previous}
              />
            ) : null}
            <Stack grow>
              <Button label={last ? t.common.done : t.common.continue} onPress={next} />
            </Stack>
          </Stack>
        }
      >
        <Stack grow justify="center" gap="xxl">
          <Card tone="muted">{step.preview}</Card>
          <Stack gap="sm">
            <Text variant="title">{step.title}</Text>
            <Text variant="label" tone="secondary">
              {step.body}
            </Text>
          </Stack>
        </Stack>
        <ProgressDots count={steps.length} index={index} />
      </Screen>
    </ThemeScope>
  );
}
