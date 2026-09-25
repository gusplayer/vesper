import { useRouter } from 'expo-router';

import {
  Button,
  HeroObject,
  ListGroup,
  ListRow,
  Screen,
  Spacer,
  Stack,
  StatusNote,
  Text,
} from '../../design/components';
import { useFocusStore, useKudosReceived, useMode } from '../../data';
import { appsTitleText } from '../../data/modes';
import { OPEN_SESSION_CAP_MS } from '../../domain/session';
import { HOUR } from '../../domain/time';
import { closingBlockingNote } from '../../features/session/blockingReach';
import { blockingReachOf } from '../../features/session/blockingReachOf';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { useBlockBack } from '../../lib/useBlockBack';
import { useNow } from '../../lib/useNow';

/** The kudos line only needs to know which week it is. */
const CLOCK_MS = 60_000;

/**
 * Brick's 'First tap complete': the object, a line, and a card of what happened.
 *
 * The rows come from the closed session, never from the running-mode slot of the
 * store, which a waiting routine overwrites the moment this session closes. The
 * blocking row says what was really blocked on this phone: the mode's real selection,
 * or "Ninguno" as a plain fact (a mode may block no apps by choice, ADR-0047 §1), with
 * the reason under the list only when the phone itself cannot block. The example list
 * never counts.
 */
export default function SessionCompleteScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings();
  const t = strings.session.complete;
  const closed = useFocusStore((state) => state.lastClosed);
  const completedCount = useFocusStore((state) => state.completedCount);
  const mode = useMode(closed?.blockProfile ?? undefined);
  const first = completedCount === 1;
  // An open session that hit its cap was closed by the app, not finished by the user.
  const capped = closed !== null && closed.open && closed.outcome === 'expired';
  const now = useNow(CLOCK_MS);
  // The one place outside Actividad the circle speaks, and it is a line, not a notice (ADR-0021).
  const kudos = useKudosReceived(now);
  const reach = mode === null ? null : blockingReachOf(mode);
  const blockingNote = reach === null ? null : closingBlockingNote(reach, t);

  return (
    <Screen footer={<Button label={strings.common.continue} onPress={() => router.dismissTo('/(tabs)')} />}>
      <Spacer />
      <Stack align="center" gap="xl">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {capped ? t.cappedTitle(OPEN_SESSION_CAP_MS / HOUR) : first ? t.firstTitle : t.title}
          </Text>
          <Text tone="secondary" align="center">
            {capped ? t.cappedSubtitle : t.subtitle}
          </Text>
        </Stack>
      </Stack>
      <Spacer />
      <Stack gap="sm">
        <ListGroup>
          <ListRow label={t.mode} value={mode?.name ?? strings.common.empty} valueLines={2} />
          {mode !== null && reach !== null && reach.kind === 'real' ? (
            <ListRow label={appsTitleText(mode.behavior, strings.modes)} value={reach.summary} />
          ) : (
            <ListRow label={t.blocking} value={t.blockingNone} />
          )}
          <ListRow label={t.duration} value={durationText(closed?.actualMs ?? 0)} />
          {closed === null || closed.intention === null ? null : (
            <ListRow label={t.intention} description={closed.intention} />
          )}
        </ListGroup>
        {blockingNote === null ? null : <StatusNote icon="info" text={blockingNote} />}
      </Stack>
      {kudos.count > 0 ? (
        <Text variant="caption" tone="secondary" align="center">
          {strings.circle.kudos.received(kudos.names)}
        </Text>
      ) : null}
    </Screen>
  );
}
