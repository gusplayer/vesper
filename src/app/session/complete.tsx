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
import { useFocusStore, useKudosReceived, useMode } from '../../data';
import { appsTitleText } from '../../data/modes';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { useBlockBack } from '../../lib/useBlockBack';
import { useNow } from '../../lib/useNow';

/** The kudos line only needs to know which week it is. */
const CLOCK_MS = 60_000;

/** Brick's 'First tap complete': the object, a line, and a card of what happened. */
export default function SessionCompleteScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings();
  const t = strings.session.complete;
  const closed = useFocusStore((state) => state.lastClosed);
  const completedCount = useFocusStore((state) => state.completedCount);
  const modeId = useFocusStore((state) => state.modeId);
  const mode = useMode(modeId ?? undefined);
  const first = completedCount === 1;
  // An open session that hit its cap was closed by the app, not finished by the user.
  const capped = closed !== null && closed.open && closed.outcome === 'expired';
  const now = useNow(CLOCK_MS);
  // The one place outside Actividad the circle speaks, and it is a line, not a notice (ADR-0021).
  const kudos = useKudosReceived(now);

  return (
    <Screen footer={<Button label={strings.common.continue} onPress={() => router.dismissTo('/(tabs)')} />}>
      <Spacer />
      <Stack align="center" gap="xl">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {capped ? t.cappedTitle : first ? t.firstTitle : t.title}
          </Text>
          <Text tone="secondary" align="center">
            {capped ? t.cappedSubtitle : t.subtitle}
          </Text>
        </Stack>
      </Stack>
      <Spacer />
      <ListGroup>
        <ListRow label={t.mode} value={mode?.name ?? strings.common.empty} />
        <ListRow
          label={appsTitleText(mode?.behavior ?? 'block', strings.modes)}
          value={String(mode?.appIds.length ?? 0)}
        />
        <ListRow label={t.duration} value={durationText(closed?.actualMs ?? 0)} />
        {closed === null || closed.intention === null ? null : (
          <ListRow label={t.intention} value={closed.intention} />
        )}
      </ListGroup>
      {kudos.count > 0 ? (
        <Text variant="caption" tone="secondary" align="center">
          {strings.circle.kudos.received(kudos.names)}
        </Text>
      ) : null}
    </Screen>
  );
}
