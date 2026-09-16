import { useState } from 'react';

import { Button, Sheet, Stack, Text } from '../../design/components';
import { EMERGENCY_WAIT_MS } from '../../domain/exitRitual';
import { SECOND } from '../../domain/time';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

type EmergencySheetProps = {
  left: number;
  onStay: () => void;
  onUse: () => void;
};

/**
 * The emergency unlock is for emergencies: it waits ten seconds before it can be
 * used, says what it costs, and keeps "Seguir enfocado" as the big button.
 */
export function EmergencySheet({ left, onStay, onUse }: EmergencySheetProps) {
  const strings = useStrings().session;
  const t = strings.emergency;
  const [openedAt] = useState(() => Date.now());
  const now = useNow(SECOND);
  const waitLeft = Math.max(0, openedAt + EMERGENCY_WAIT_MS - now);
  const ready = waitLeft === 0;

  return (
    <Sheet visible title={t.title} onClose={onStay}>
      <Stack gap="md">
        <Text variant="body">{t.body(left)}</Text>
        <Text variant="caption" tone="secondary">
          {ready ? t.ready : t.wait(Math.ceil(waitLeft / SECOND))}
        </Text>
        <Button label={strings.stayFocused} onPress={onStay} />
        <Button variant="ghost" label={t.use} onPress={onUse} disabled={!ready} />
      </Stack>
    </Sheet>
  );
}
