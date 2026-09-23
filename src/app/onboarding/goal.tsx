import { router } from 'expo-router';
import { useState } from 'react';

import { useModeIdeas } from '../../data';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, Card, Check, Screen, Section, Stack, Text } from '../../design/components';
import { GOAL_OPTIONS } from '../../features/onboarding/goalOptions';
import { useStrings } from '../../i18n';

/** The first real step: what the first mode is for. Picks a MODE_IDEAS entry. */
export default function GoalScreen() {
  const t = useStrings();
  const ideas = useModeIdeas();
  const setGoal = useOnboardingDraft((state) => state.setGoal);
  const [chosen, setChosen] = useState<string | null>(null);

  const next = () => {
    const idea = ideas.find((entry) => entry.id === chosen);
    if (idea === undefined) {
      return;
    }
    setGoal(idea);
    router.push('/onboarding/apps');
  };

  return (
    <Screen
      scroll
      footer={<Button label={t.common.continue} onPress={next} disabled={chosen === null} />}
    >
      <Text variant="title">{t.onboarding.goal.title}</Text>
      <Text variant="label" tone="secondary">
        {t.onboarding.goal.subtitle}
      </Text>
      <Section title={t.onboarding.goal.pickOne}>
        {GOAL_OPTIONS.map((option) => {
          const label = t.onboarding.goal.options[option.label];
          return (
            <Card key={option.ideaId} onPress={() => setChosen(option.ideaId)} accessibilityLabel={label}>
              <Stack direction="row" align="center" justify="space-between" gap="md">
                <Text variant="body">{label}</Text>
                <Check checked={chosen === option.ideaId} />
              </Stack>
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}
