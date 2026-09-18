import { useState } from 'react';

import { Button, Chip, Section, Sheet, Stack } from '../../design/components';
import { useStrings } from '../../i18n';

type TimeSheetProps = {
  visible: boolean;
  title: string;
  /** Minutes from midnight, or null for "until you end it" when `openEnd` is allowed. */
  value: number | null;
  /** Offers the "until you end it" chip. Only the end of a window can be open. */
  openEnd?: boolean;
  onClose: () => void;
  onDone: (minutes: number | null) => void;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];

type Pick = { hour: number; minute: number; open: boolean };

/** What the sheet shows before any tap: the value it opened with, or "until you end it". */
function pickFrom(value: number | null): Pick {
  return value === null
    ? { hour: 0, minute: 0, open: true }
    : { hour: Math.floor(value / 60), minute: value % 60, open: false };
}

/**
 * The prototype's time picker: chips for the hour and the quarter, no native wheel
 * (guide: schedules/edit). The choice is local until "Done".
 */
export function TimeSheet({ visible, title, value, openEnd = false, onClose, onDone }: TimeSheetProps) {
  const t = useStrings();
  // The taps since the sheet opened, or null while it still shows the value it opened
  // with. Dropped each time the sheet opens (or the value moves under it), during
  // render rather than in an effect, so the first frame already has the right chips.
  const [pick, setPick] = useState<Pick | null>(null);
  const [openedWith, setOpenedWith] = useState({ visible, value });
  if (openedWith.visible !== visible || openedWith.value !== value) {
    setOpenedWith({ visible, value });
    if (visible) {
      setPick(null);
    }
  }
  const { hour, minute, open } = pick ?? pickFrom(value);

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {openEnd ? (
        <Chip
          label={t.onboarding.routine.openEnd}
          selected={open}
          onPress={() => setPick({ hour, minute, open: true })}
        />
      ) : null}
      <Section title={t.onboarding.routine.hour}>
        <Stack direction="row" wrap gap="sm">
          {HOURS.map((option) => (
            <Chip
              key={option}
              label={String(option)}
              selected={!open && hour === option}
              onPress={() => setPick({ hour: option, minute, open: false })}
            />
          ))}
        </Stack>
      </Section>
      <Section title={t.onboarding.routine.minutes}>
        <Stack direction="row" wrap gap="sm">
          {MINUTES.map((option) => (
            <Chip
              key={option}
              label={String(option).padStart(2, '0')}
              selected={!open && minute === option}
              onPress={() => setPick({ hour, minute: option, open: false })}
            />
          ))}
        </Stack>
      </Section>
      <Button label={t.common.done} onPress={() => onDone(open ? null : hour * 60 + minute)} />
    </Sheet>
  );
}
