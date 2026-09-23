import { useRouter } from 'expo-router';

import { Card, IconCircle, PageHeader, Screen, Stack, Text } from '../../design/components';
import { useAppStore, useModeIdeas } from '../../data';
import type { ModeIdea } from '../../data/types';
import { useStrings } from '../../i18n';

/** Ready-made modes. The plus creates one and returns to the list. */
export default function ModeIdeasScreen() {
  const router = useRouter();
  const t = useStrings();
  const ideas = useModeIdeas();
  const upsertMode = useAppStore((state) => state.upsertMode);

  const add = (idea: ModeIdea) => {
    upsertMode({
      name: idea.name,
      behavior: 'block',
      appIds: [...idea.appIds],
      websiteIds: [],
      depth: idea.depth,
      activityId: idea.activityId,
    });
    router.back();
  };

  return (
    <Screen scroll>
      <PageHeader onClose={() => router.back()} title={t.modes.ideas.title} />
      {ideas.map((idea) => (
        <Card key={idea.id}>
          <Stack direction="row" align="center" gap="md">
            <IconCircle name={idea.icon} />
            <Stack gap="xs" grow>
              <Text weight="medium">{idea.name}</Text>
              <Text variant="label" tone="secondary">
                {idea.description}
              </Text>
            </Stack>
            <IconCircle
              name="plus"
              tone="ink"
              onPress={() => add(idea)}
              accessibilityLabel={t.modes.ideas.addA11y(idea.name)}
            />
          </Stack>
        </Card>
      ))}
    </Screen>
  );
}
