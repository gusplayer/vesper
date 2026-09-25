import { useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';

import { Card, Check, IconCircle, PageHeader, Screen, Stack, Text } from '../../design/components';
import { useAppStore, useModeIdeas, useModes } from '../../data';
import { findModeByName } from '../../data/modes';
import type { ModeIdea } from '../../data/types';
import { hasRealPicker } from '../../features/modes/realBlocking';
import { useStrings } from '../../i18n';
import { status as blockingStatus } from '../../platform/blocking';

/**
 * Ready-made modes. The plus creates one and opens its editor, so the user sees what
 * was made and can pick its apps there. An idea whose name is already one of the modes
 * shows a check instead: adding it again would make a twin.
 *
 * One app list per mode (ADR-0047 §2): where the phone has a real picker, an idea
 * brings no apps of its own — the card says only its depth, and the mode starts with
 * none, which is a valid choice. Where only the catalogue exists, the idea's example
 * apps come with it and the card says how many, as an example.
 */
export default function ModeIdeasScreen() {
  const router = useRouter();
  const t = useStrings();
  const ideas = useModeIdeas();
  const modes = useModes();
  const upsertMode = useAppStore((state) => state.upsertMode);
  const real = hasRealPicker(blockingStatus());

  const add = (idea: ModeIdea) => {
    const mode = upsertMode({
      name: idea.name,
      behavior: 'block',
      // The catalogue ids mean nothing where the real picker is the list.
      appIds: real ? [] : [...idea.appIds],
      websiteIds: [],
      depth: idea.depth,
      activityId: idea.activityId,
    });
    router.replace({ pathname: '/modes/edit', params: { id: mode.id } });
  };

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router)} title={t.modes.ideas.title} />
      {ideas.map((idea) => {
        const added = findModeByName(modes, idea.name) !== undefined;
        return (
          <Card key={idea.id}>
            <Stack direction="row" align="center" gap="md">
              <IconCircle name={idea.icon} />
              <Stack gap="xs" grow>
                <Text weight="medium">{idea.name}</Text>
                <Text variant="label" tone="secondary">
                  {idea.description}
                </Text>
                <Text variant="label" tone="secondary">
                  {added
                    ? t.modes.ideas.added
                    : real || idea.appIds.length === 0
                      ? t.depth.label[idea.depth]
                      : t.modes.ideas.meta(
                          t.depth.label[idea.depth],
                          t.modes.summary.example(t.modes.summary.apps(idea.appIds.length)),
                        )}
                </Text>
              </Stack>
              {added ? (
                <Check checked tone="success" />
              ) : (
                <IconCircle
                  name="plus"
                  tone="ink"
                  onPress={() => add(idea)}
                  accessibilityLabel={t.modes.ideas.addA11y(idea.name)}
                />
              )}
            </Stack>
          </Card>
        );
      })}
    </Screen>
  );
}
