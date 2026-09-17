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
  const params = useLocalSearchParams<{ emergency?: string }>();
  const emergency = params.emergency === '1';
  const served = durationText(closed?.actualMs ?? 0);

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
        <ListRow label={strings.session.complete.mode} value={mode?.name ?? strings.common.empty} />
        <ListRow label={strings.session.complete.duration} value={served} />
        {closed === null || closed.exitReason === null || emergency ? null : (
          <ListRow label={t.reason} value={closed.exitReason} />
        )}
      </ListGroup>
    </Screen>
  );
}
