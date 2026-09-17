import { useState } from 'react';

import { Chip, Icon, Sheet, Stack, Tappable, Text } from '../../design/components';
import { PLANNED_OPTIONS_MS, usePlannedStore } from '../../data/modes';
import { useStrings } from '../../i18n';
import { minutesText } from '../../lib/format';

/**
 * The duration of the next session, as a row above the focus button: '25 min ⌄' or
 * 'Sin límite ⌄'. Tapping it opens a sheet of chips; choosing one closes the sheet and
 * changes the button's label, and nothing starts (ADR-0022). Null is "sin límite".
 */
export function DurationPicker() {
  const strings = useStrings();
  const t = strings.session.duration;
  const row = strings.focus.durationPicker;
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const setPlannedMs = usePlannedStore((state) => state.setPlannedMs);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const choose = (ms: number | null) => {
    setPlannedMs(ms);
    close();
  };
  const current = plannedMs === null ? row.open : row.minutes(minutesText(plannedMs));

  return (
    <>
      <Tappable onPress={() => setOpen(true)} accessibilityLabel={row.label(current)}>
        <Stack direction="row" align="center" justify="center" gap="xs">
          <Text variant="label" tone="secondary">
            {current}
          </Text>
          <Icon name="chevron-down" size="sm" tone="secondary" />
        </Stack>
      </Tappable>

      <Sheet visible={open} title={t.title} onClose={close}>
        <Stack direction="row" gap="sm" wrap>
          {PLANNED_OPTIONS_MS.map((ms) => (
            <Chip key={ms} label={t.minutes(minutesText(ms))} selected={ms === plannedMs} onPress={() => choose(ms)} />
          ))}
          <Chip label={t.open} selected={plannedMs === null} onPress={() => choose(null)} />
        </Stack>
        <Text variant="caption" tone="secondary">
          {t.openHint}
        </Text>
      </Sheet>
    </>
  );
}
