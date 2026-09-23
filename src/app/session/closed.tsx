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
import { KEY_EXIT_REASON } from '../../domain/key';
import { EMERGENCY_EXIT_REASON, exitReasonText } from '../../features/session/exitReason';
import { useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { useBlockBack } from '../../lib/useBlockBack';

/**
 * A session left by hand (ADR-0025): the quiet sister of `session/complete`. The store
 * already flipped the theme back to light when it closed the session; the paper flood
 * that brought us here lingers over the page for one fade. One line says what stays
 * counted, the rows say which mode, how long and why, and if an emergency unlock paid
 * for the exit the page says what it cost. It does not celebrate. No back gesture.
 */
export default function SessionClosedScreen() {
  const router = useRouter();
  useBlockBack();
  const strings = useStrings();
  const t = strings.session.closed;
  const closed = useFocusStore((state) => state.lastClosed);
  const modeId = useFocusStore((state) => state.modeId);
  const mode = useMode(modeId ?? undefined);
  const emergencyLeft = useSettings().emergencyLeft;
  const params = useLocalSearchParams<{ emergency?: string; key?: string }>();
  // The route param says it on arrival; the stored reason says it after a relaunch.
  const emergency = params.emergency === '1' || closed?.exitReason === EMERGENCY_EXIT_REASON;
  // The receipt of ADR-0034: the key holder is standing here, reading this with the
  // person whose phone it is. It says how long and whether it ran its time. Nothing
  // travels and nothing is kept beyond the session row that already existed.
  const byKey = params.key === '1' || closed?.exitReason === KEY_EXIT_REASON;
  const served = durationText(closed?.actualMs ?? 0);

  return (
    <Screen footer={<Button label={strings.common.continue} onPress={() => router.dismissTo('/(tabs)')} />}>
      <Spacer />
      <Stack align="center" gap="xl">
        <HeroObject size="md" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {byKey ? strings.keys.receipt.title : t.title}
          </Text>
          <Text tone="secondary" align="center">
            {byKey ? strings.keys.receipt.duration(served) : t.counted(served)}
          </Text>
          {byKey ? (
            <Text tone="secondary" align="center">
              {closed?.outcome === 'completed' ? strings.keys.receipt.completed : strings.keys.receipt.cut}
            </Text>
          ) : null}
          {emergency ? (
            <Text tone="secondary" align="center">
              {t.emergency(emergencyLeft)}
            </Text>
          ) : null}
        </Stack>
      </Stack>
      <Spacer />
      <ListGroup>
        <ListRow label={strings.session.complete.mode} value={mode?.name ?? strings.common.empty} />
        <ListRow label={strings.session.complete.duration} value={served} />
        {closed === null || closed.exitReason === null || emergency || byKey ? null : (
          <ListRow label={t.reason} value={exitReasonText(closed.exitReason, strings.session)} />
        )}
      </ListGroup>
    </Screen>
  );
}
