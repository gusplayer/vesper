import { useState } from 'react';

import { ChipGroup, DropdownTitle, FieldRow, Sheet, Stack, Text, type ChipOption } from '../../design/components';
import { PLANNED_OPTIONS_MS, usePlannedStore } from '../../data/modes';
import { OPEN_SESSION_CAP_MS } from '../../domain/session';
import { HOUR } from '../../domain/time';
import { useStrings } from '../../i18n';
import { minutesText } from '../../lib/format';

/** The chip value for "sin límite": the store says it with null, a chip needs a key. */
const OPEN = 'open';

/** Long enough for one sentence of purpose; the closing page shows it in a row. */
const INTENTION_MAX = 120;

type DurationPickerProps = {
  /** The intention for the next session (ADR-0047 §10), owned by Focus until it starts. */
  intention: string;
  onIntentionChange: (text: string) => void;
};

/**
 * The duration of the next session, as a row above the focus button: '25 min ⌄' or
 * 'Sin límite ⌄'. Tapping it opens a sheet of chips; choosing one closes the sheet and
 * changes the button's label, and nothing starts (ADR-0022). Null is "sin límite".
 *
 * A duration that is not one of the chips (a routine's own length, set by its play in
 * Rutinas) gets a chip of its own, already chosen, so the sheet always shows what the
 * button will do. The same sheet holds the optional intention; once written, it shows
 * under the row in quotes, so the page says what the next session is for.
 */
export function DurationPicker({ intention, onIntentionChange }: DurationPickerProps) {
  const strings = useStrings();
  const t = strings.session.duration;
  const row = strings.focus.durationPicker;
  const plannedMs = usePlannedStore((state) => state.plannedMs);
  const setPlannedMs = usePlannedStore((state) => state.setPlannedMs);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const choose = (value: number | typeof OPEN) => {
    setPlannedMs(value === OPEN ? null : value);
    close();
  };
  const current = plannedMs === null ? row.open : row.minutes(minutesText(plannedMs));

  const durations =
    plannedMs === null || PLANNED_OPTIONS_MS.includes(plannedMs)
      ? PLANNED_OPTIONS_MS
      : [...PLANNED_OPTIONS_MS, plannedMs].sort((a, b) => a - b);
  const options: ChipOption<number | typeof OPEN>[] = [
    ...durations.map((ms) => ({ value: ms, label: t.minutes(minutesText(ms)) })),
    { value: OPEN, label: t.open },
  ];
  const written = intention.trim();

  return (
    <>
      <Stack align="center" gap="xxs">
        <DropdownTitle
          label={current}
          size="label"
          tone="secondary"
          onPress={() => setOpen(true)}
          accessibilityLabel={row.hint}
        />
        {written === '' ? null : (
          <Text variant="caption" tone="secondary" align="center" numberOfLines={2}>
            {row.intentionQueued(written)}
          </Text>
        )}
      </Stack>

      <Sheet visible={open} title={t.title} onClose={close}>
        <ChipGroup
          options={options}
          value={plannedMs === null ? OPEN : plannedMs}
          onChange={choose}
          accessibilityLabel={t.title}
        />
        <Text variant="caption" tone="secondary">
          {t.openHint(OPEN_SESSION_CAP_MS / HOUR)}
        </Text>
        <Stack gap="xs">
          <FieldRow
            label={row.intention}
            value={intention}
            onChangeText={onIntentionChange}
            placeholder={row.intentionPlaceholder}
            maxLength={INTENTION_MAX}
            returnKeyType="done"
            accessibilityHint={row.intentionHint}
          />
          <Text variant="caption" tone="secondary">
            {row.intentionHint}
          </Text>
        </Stack>
      </Sheet>
    </>
  );
}
