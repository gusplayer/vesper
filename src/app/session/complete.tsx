import { useRouter } from 'expo-router';

import {
  Button,
  HeroObject,
  ListGroup,
  ListRow,
  Screen,
  Spacer,
  Stack,
  Text,
} from '../../design/components';
import { useFocusStore, useMode } from '../../data';
import { appsTitleText } from '../../data/modes';
import { durationText } from '../../lib/format';

/** Brick's 'First tap complete': the object, a line, and a card of what happened. */
export default function SessionCompleteScreen() {
  const router = useRouter();
  const closed = useFocusStore((state) => state.lastClosed);
  const completedCount = useFocusStore((state) => state.completedCount);
  const modeId = useFocusStore((state) => state.modeId);
  const mode = useMode(modeId ?? undefined);
  const first = completedCount === 1;

  return (
    <Screen footer={<Button label="Continuar" onPress={() => router.dismissTo('/(tabs)')} />}>
      <Spacer />
      <Stack align="center" gap="xl">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {first ? 'Primera sesión completa.' : 'Sesión completa.'}
          </Text>
          <Text tone="secondary" align="center">
            Recuperaste tu tiempo.
          </Text>
        </Stack>
      </Stack>
      <Spacer />
      <ListGroup>
        <ListRow label="Modo" value={mode?.name ?? '—'} />
        <ListRow
          label={appsTitleText(mode?.behavior ?? 'block')}
          value={String(mode?.appIds.length ?? 0)}
        />
        <ListRow label="Duración" value={durationText(closed?.actualMs ?? 0)} />
        {closed === null || closed.intention === null ? null : (
          <ListRow label="Intención" value={closed.intention} />
        )}
      </ListGroup>
    </Screen>
  );
}
