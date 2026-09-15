import { Button, Chip, Sheet, Stack, Text } from '../../design/components';
import { PLANNED_OPTIONS_MS, usePlannedStore } from '../../data/modes';
import { minutesText } from '../../lib/format';

type DurationSheetProps = {
  visible: boolean;
  onClose: () => void;
  onStart: (plannedMs: number) => void;
};

/**
 * The question the focus button asks on a tap: how long. The chosen chip is
 * remembered, so a long press next time skips the question.
 */
export function DurationSheet({ visible, onClose, onStart }: DurationSheetProps) {
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const setPlannedMs = usePlannedStore((state) => state.setPlannedMs);

  return (
    <Sheet visible={visible} title="¿Cuánto tiempo?" onClose={onClose}>
      <Stack direction="row" gap="sm" wrap>
        {PLANNED_OPTIONS_MS.map((ms) => (
          <Chip
            key={ms}
            label={`${minutesText(ms)} min`}
            selected={ms === plannedMs}
            onPress={() => setPlannedMs(ms)}
          />
        ))}
      </Stack>
      <Text variant="caption" tone="secondary">
        La próxima vez, mantén el botón para empezar sin preguntar.
      </Text>
      <Button label={`Enfocar ${minutesText(plannedMs)} min`} onPress={() => onStart(plannedMs)} />
    </Sheet>
  );
}
