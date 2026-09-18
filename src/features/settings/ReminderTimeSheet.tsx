import { Chip, Sheet, Stack } from '../../design/components';
import { atMinuteOfDay } from '../../domain/day';
import { useStrings } from '../../i18n';
import { clockText } from '../../lib/format';

type ReminderTimeSheetProps = {
  visible: boolean;
  /** Minute of the local day the daily notices fire at. */
  value: number;
  onChange: (minutes: number) => void;
  onClose: () => void;
};

/** The hours the daily notices may fire at, on the hour. Quiet hours start at 22:00 (ADR-0027 §2). */
const FIRST_HOUR = 8;
const LAST_HOUR = 21;
const MINUTES_PER_HOUR = 60;

const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => (FIRST_HOUR + i) * MINUTES_PER_HOUR);

/** '20:00' for a minute of the day, through the same formatter the rest of the app uses. */
export function reminderTimeText(minutes: number): string {
  return clockText(atMinuteOfDay(Date.now(), minutes));
}

/** A sheet of chips, one per hour from 8:00 to 21:00, for the daily reminder time. */
export function ReminderTimeSheet({ visible, value, onChange, onClose }: ReminderTimeSheetProps) {
  const t = useStrings();
  const choose = (minutes: number) => {
    onChange(minutes);
    onClose();
  };

  return (
    <Sheet visible={visible} title={t.settings.notifications.reminderTime.sheet} onClose={onClose}>
      <Stack direction="row" gap="sm" wrap>
        {HOURS.map((minutes) => (
          <Chip key={minutes} label={reminderTimeText(minutes)} selected={minutes === value} onPress={() => choose(minutes)} />
        ))}
      </Stack>
    </Sheet>
  );
}
