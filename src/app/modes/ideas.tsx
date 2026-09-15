import { useRouter } from 'expo-router';

import { Card, IconCircle, PageHeader, Screen, Stack, Text } from '../../design/components';
import { MODE_IDEAS, useAppStore } from '../../data';
import type { ModeIdea } from '../../data/types';

/** Ready-made modes. The plus creates one and returns to the list. */
export default function ModeIdeasScreen() {
  const router = useRouter();
  const upsertMode = useAppStore((state) => state.upsertMode);

  const add = (idea: ModeIdea) => {
    upsertMode({
      name: idea.name,
      behavior: 'block',
      appIds: [...idea.appIds],
      websiteIds: [],
      depth: idea.depth,
      activityId: 'trabajo',
    });
    router.back();
  };

  return (
    <Screen scroll>
      <PageHeader onClose={() => router.back()} title="Explorar ideas" />
      {MODE_IDEAS.map((idea) => (
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
              accessibilityLabel={`agregar ${idea.name}`}
            />
          </Stack>
        </Card>
      ))}
    </Screen>
  );
}
