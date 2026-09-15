import { useState } from 'react';

import { Button, Sheet, Stack, Text } from '../../design/components';
import { EMERGENCY_WAIT_MS } from '../../domain/exitRitual';
import { SECOND } from '../../domain/time';
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
  const [openedAt] = useState(() => Date.now());
  const now = useNow(SECOND);
  const waitLeft = Math.max(0, openedAt + EMERGENCY_WAIT_MS - now);
  const ready = waitLeft === 0;

  return (
    <Sheet visible title="Desbloqueo de emergencia" onClose={onStay}>
      <Stack gap="md">
        <Text variant="body">
          {`Te quedan ${left} este mes. Termina la sesión ahora mismo, sin el ritual, y cuenta como cancelada.`}
        </Text>
        <Text variant="caption" tone="secondary">
          {ready ? 'Si de verdad es una emergencia, adelante.' : `Puedes confirmar en ${Math.ceil(waitLeft / SECOND)} s.`}
        </Text>
        <Button label="Seguir enfocado" onPress={onStay} />
        <Button variant="ghost" label="Usar un desbloqueo" onPress={onUse} disabled={!ready} />
      </Stack>
    </Sheet>
  );
}
