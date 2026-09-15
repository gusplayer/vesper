import { router } from 'expo-router';
import { useState } from 'react';

import { MODE_IDEAS } from '../../data';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, Card, Check, Screen, Section, Stack, Text } from '../../design/components';
import { GOAL_OPTIONS } from '../../features/onboarding/goalOptions';

/** The first real step: what the first mode is for. Picks a MODE_IDEAS entry. */
export default function GoalScreen() {
  const setGoal = useOnboardingDraft((state) => state.setGoal);
  const [chosen, setChosen] = useState<string | null>(null);

  const next = () => {
    const idea = MODE_IDEAS.find((entry) => entry.id === chosen);
    if (idea === undefined) {
      return;
    }
    setGoal(idea.id, idea.name, idea.appIds);
    router.push('/onboarding/apps');
  };

  return (
    <Screen
      scroll
      footer={<Button label="Continuar" onPress={next} disabled={chosen === null} />}
    >
      <Text variant="title">¿Para qué es tu primer modo?</Text>
      <Text variant="label" tone="secondary">
        Cada modo bloquea las apps que elijas. Podés sumar más cuando quieras.
      </Text>
      <Section title="Elegí una">
        {GOAL_OPTIONS.map((option) => (
          <Card
            key={option.ideaId}
            onPress={() => setChosen(option.ideaId)}
            accessibilityLabel={option.label}
          >
            <Stack direction="row" align="center" justify="space-between" gap="md">
              <Text variant="body">{option.label}</Text>
              <Check checked={chosen === option.ideaId} />
            </Stack>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
