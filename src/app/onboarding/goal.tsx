import { router } from 'expo-router';
import { useState } from 'react';

import { useModeIdeas } from '../../data';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, ChoiceCard, PageHeader, Screen, Section, StatusNote, Text } from '../../design/components';
import { GOAL_OPTIONS } from '../../features/onboarding/goalOptions';
import { stepProgress } from '../../features/onboarding/steps';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';

/**
 * The first real step: what the first mode is for. Picks a MODE_IDEAS entry, and
 * each answer says what it creates — the idea's purpose and its depth — because the
 * work answer makes a deep mode, the one a session cannot be left from.
 */
export default function GoalScreen() {
  const t = useStrings();
  const ideas = useModeIdeas();
  const goalId = useOnboardingDraft((state) => state.goalId);
  const setGoal = useOnboardingDraft((state) => state.setGoal);
  const [chosen, setChosen] = useState<string | null>(goalId);

  const copy = t.onboarding.goal;
  const chosenIdea = ideas.find((entry) => entry.id === chosen);

  const next = () => {
    if (chosenIdea === undefined) {
      return;
    }
    // Only a different answer refills the draft: coming back here and continuing with
    // the same one must not throw away the apps and the routine edited after it.
    if (useOnboardingDraft.getState().goalId !== chosenIdea.id) {
      setGoal(chosenIdea);
    }
    router.push('/onboarding/screen-time');
  };

  return (
    <Screen
      scroll
      footer={<Button label={t.common.continue} onPress={next} disabled={chosenIdea === undefined} />}
    >
      <PageHeader onBack={() => goBack(router)} progress={stepProgress('goal', t.onboarding.progress)} />
      <Text variant="title">{copy.title}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>
      <Section title={copy.pickOne}>
        {GOAL_OPTIONS.map((option) => {
          const idea = ideas.find((entry) => entry.id === option.ideaId);
          return (
            <ChoiceCard
              key={option.ideaId}
              title={copy.options[option.label]}
              description={idea === undefined ? undefined : copy.optionLine(idea.description, t.depth.label[idea.depth])}
              selected={chosen === option.ideaId}
              onPress={() => setChosen(option.ideaId)}
            />
          );
        })}
      </Section>
      {chosenIdea?.depth === 'deep' ? <StatusNote text={copy.deepNote} icon="info" live /> : null}
    </Screen>
  );
}
