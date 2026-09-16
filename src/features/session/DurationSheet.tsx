import { Button, Chip, Sheet, Stack, Text } from '../../design/components';
import { PLANNED_OPTIONS_MS, usePlannedStore } from '../../data/modes';
import { useStrings } from '../../i18n';
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
  const t = useStrings().session.duration;
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const setPlannedMs = usePlannedStore((state) => state.setPlannedMs);

  return (
    <Sheet visible={visible} title={t.title} onClose={onClose}>
      <Stack direction="row" gap="sm" wrap>
        {PLANNED_OPTIONS_MS.map((ms) => (
          <Chip
            key={ms}
            label={t.minutes(minutesText(ms))}
            selected={ms === plannedMs}
            onPress={() => setPlannedMs(ms)}
          />
        ))}
      </Stack>
      <Text variant="caption" tone="secondary">
        {t.hint}
      </Text>
      <Button label={t.start(minutesText(plannedMs))} onPress={() => onStart(plannedMs)} />
    </Sheet>
  );
}
