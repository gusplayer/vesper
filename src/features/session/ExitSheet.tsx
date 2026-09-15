import { useEffect, useRef, useState } from 'react';

import { Button, FieldRow, Sheet, Text } from '../../design/components';
import { FIRM_WAIT_MS } from '../../domain/session';
import { SECOND } from '../../domain/time';
import { useNow } from '../../lib/useNow';

type ExitSheetProps = {
  /** The user changed their mind. */
  onStay: () => void;
  /** The wait ran out; the session ends with whatever was written. */
  onLeave: (reason: string) => void;
};

/**
 * The 'firm' way out: it asks why and waits FIRM_WAIT_MS before letting go. Mounted
 * only while open, so the clock starts when the sheet appears.
 */
export function ExitSheet({ onStay, onLeave }: ExitSheetProps) {
  const [reason, setReason] = useState('');
  const [openedAt] = useState(() => Date.now());
  const now = useNow(1000);
  const leftMs = openedAt + FIRM_WAIT_MS - now;
  const due = leftMs <= 0;

  // The latest reason and callback, read only when the wait ends, so the effect
  // depends on nothing but `due` and fires exactly once.
  const latest = useRef({ reason, onLeave });
  latest.current = { reason, onLeave };
  useEffect(() => {
    if (due) {
      latest.current.onLeave(latest.current.reason);
    }
  }, [due]);

  const seconds = Math.max(0, Math.ceil(leftMs / SECOND));

  return (
    <Sheet visible title="¿Por qué?" onClose={onStay}>
      <FieldRow
        label="Motivo"
        value={reason}
        onChangeText={setReason}
        placeholder="Una línea alcanza"
        autoFocus
      />
      <Text variant="caption" tone="secondary" align="center">
        {`Salís en ${seconds} s`}
      </Text>
      <Button variant="ghost" label="Seguir enfocado" onPress={onStay} />
    </Sheet>
  );
}
