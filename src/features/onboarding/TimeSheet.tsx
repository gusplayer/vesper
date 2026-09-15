import { useEffect, useState } from 'react';

import { Button, Chip, Section, Sheet, Stack } from '../../design/components';

type TimeSheetProps = {
  visible: boolean;
  title: string;
  /** Minutes from midnight, or null for "until you end it" when `openEnd` is allowed. */
  value: number | null;
  /** Offers the "Hasta que lo termines" chip. Only the end of a window can be open. */
  openEnd?: boolean;
  onClose: () => void;
  onDone: (minutes: number | null) => void;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];
const OPEN_END_LABEL = 'Hasta que lo termines';

/**
 * The prototype's time picker: chips for the hour and the quarter, no native wheel
 * (guide: schedules/edit). The choice is local until "Listo".
 */
export function TimeSheet({ visible, title, value, openEnd = false, onClose, onDone }: TimeSheetProps) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [open, setOpen] = useState(false);

  // Start from the current value each time the sheet opens.
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (value === null) {
      setOpen(true);
      setHour(0);
      setMinute(0);
      return;
    }
    setOpen(false);
    setHour(Math.floor(value / 60));
    setMinute(value % 60);
  }, [visible, value]);

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {openEnd ? (
        <Chip label={OPEN_END_LABEL} selected={open} onPress={() => setOpen(true)} />
      ) : null}
      <Section title="Hora">
        <Stack direction="row" wrap gap="sm">
          {HOURS.map((option) => (
            <Chip
              key={option}
              label={String(option)}
              selected={!open && hour === option}
              onPress={() => {
                setOpen(false);
                setHour(option);
              }}
            />
          ))}
        </Stack>
      </Section>
      <Section title="Minutos">
        <Stack direction="row" wrap gap="sm">
          {MINUTES.map((option) => (
            <Chip
              key={option}
              label={String(option).padStart(2, '0')}
              selected={!open && minute === option}
              onPress={() => {
                setOpen(false);
                setMinute(option);
              }}
            />
          ))}
        </Stack>
      </Section>
      <Button label="Listo" onPress={() => onDone(open ? null : hour * 60 + minute)} />
    </Sheet>
  );
}
