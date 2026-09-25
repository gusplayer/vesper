import { useState } from 'react';

import { Button, Chip, ChipGroup, Section, Sheet, Stack } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { hourText } from './format';

type TimeSheetProps = {
  visible: boolean;
  /** Which end is being picked: 'Empieza' or 'Termina'. */
  title: string;
  /** Minutes from midnight, or null for "no end time" when `openEnd` is allowed. */
  value: number | null;
  /** Offers the "no end time" chip. Only the end of a window can be open. */
  openEnd?: boolean;
  onClose: () => void;
  onDone: (minutes: number | null) => void;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];
const MINUTES_PER_HOUR = 60;

type Pick = { hour: number; minute: number; open: boolean };

/** What the sheet shows before any tap: the value it opened with, or "no end time". */
function pickFrom(value: number | null): Pick {
  return value === null
    ? { hour: 0, minute: 0, open: true }
    : { hour: Math.floor(value / MINUTES_PER_HOUR), minute: value % MINUTES_PER_HOUR, open: false };
}

/**
 * The one time picker of a routine window, shared by the routine editor and the
 * onboarding step: chips for the hour and the quarter, no native wheel (guide:
 * schedules/edit). The choice is local until "Listo"; closing the sheet keeps the
 * value it opened with.
 */
export function TimeSheet({ visible, title, value, openEnd = false, onClose, onDone }: TimeSheetProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const copy = t.routines.edit;
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
        <Stack direction="row" wrap gap="sm">
          <Chip label={copy.openEnd} selected={open} onPress={() => setPick({ hour, minute, open: true })} />
        </Stack>
      ) : null}
      <Section title={copy.hour}>
        <ChipGroup
          accessibilityLabel={copy.hour}
          options={HOURS.map((option) => ({ value: option, label: hourText(option, tag) }))}
          value={open ? null : hour}
          onChange={(option) => setPick({ hour: option, minute, open: false })}
        />
      </Section>
      <Section title={copy.minutes}>
        <ChipGroup
          accessibilityLabel={copy.minutes}
          options={MINUTES.map((option) => ({ value: option, label: String(option).padStart(2, '0') }))}
          value={open ? null : minute}
          onChange={(option) => setPick({ hour, minute: option, open: false })}
        />
      </Section>
      <Button label={t.common.done} onPress={() => onDone(open ? null : hour * MINUTES_PER_HOUR + minute)} />
    </Sheet>
  );
}
