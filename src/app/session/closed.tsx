import { useLocalSearchParams, useRouter } from 'expo-router';

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
import { useFocusStore, useMode, useSettings } from '../../data';
import { EMERGENCY_EXIT_REASON, exitReasonText } from '../../features/session/exitReason';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { useBlockBack } from '../../lib/useBlockBack';

/**
 * A session left by hand (ADR-0025): the quiet sister of `session/complete`. The store
 * already flipped the theme back to light when it closed the session; the paper flood
 * that brought us here lingers over the page for one fade. One line says what stays
 * counted, the rows say which mode, how much of the plan and why, and if an emergency
 * unlock paid for the exit the page says what it cost. It does not celebrate. No back
 * gesture.
 *
 * Everything here is read from the closed session itself, never from the running-mode
 * slot of the store: a routine that was waiting starts its own session the moment this
 * one closes, and would otherwise lend this page its mode.
 */
export default function SessionClosedScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings();
  const t = strings.session.closed;
  const closed = useFocusStore((state) => state.lastClosed);
  const mode = useMode(closed?.blockProfile ?? undefined);
  const emergencyLeft = useSettings().emergencyLeft;
  const params = useLocalSearchParams<{ emergency?: string }>();
  // The route param says it on arrival; the stored reason says it too.
  const emergency = params.emergency === '1' || closed?.exitReason === EMERGENCY_EXIT_REASON;
  const served = durationText(closed?.actualMs ?? 0);
  // The headline already says what stays counted; the row adds what the plan was.
  const duration =
    closed === null ? served : closed.open ? t.servedOpen(served) : t.servedOf(served, durationText(closed.plannedMs));
  const reason = closed === null || closed.exitReason === null || emergency ? null : exitReasonText(closed.exitReason, strings.session);

  return (
    <Screen footer={<Button label={strings.common.continue} onPress={() => router.dismissTo('/(tabs)')} />}>
      <Spacer />
      <Stack align="center" gap="xl">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {t.title}
          </Text>
          <Text tone="secondary" align="center">
            {t.counted(served)}
          </Text>
          {emergency ? (
            <Text tone="secondary" align="center">
              {t.emergency(emergencyLeft)}
            </Text>
          ) : null}
        </Stack>
      </Stack>
      <Spacer />
      <ListGroup>
        <ListRow label={strings.session.complete.mode} value={mode?.name ?? strings.common.empty} valueLines={2} />
        <ListRow label={strings.session.complete.duration} value={duration} />
        {/* A typed reason or intention is a sentence: it wraps under its label instead of squeezing it. */}
        {closed === null || closed.intention === null ? null : (
          <ListRow label={strings.session.complete.intention} description={closed.intention} />
        )}
        {reason === null ? null : <ListRow label={t.reason} description={reason} />}
      </ListGroup>
    </Screen>
  );
}
