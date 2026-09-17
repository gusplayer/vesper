import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAppStore, useModes, useSchedules } from '../../data';
import {
  Button,
  Card,
  Check,
  Chip,
  DayPicker,
  FieldRow,
  Icon,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  SegmentedControl,
  Sheet,
  Stack,
  Text,
} from '../../design/components';
import { MANUAL_DEFAULT_MS } from '../../domain/routines';
import { MINUTE } from '../../domain/time';
import { daysText, overlaps, timeText } from '../../features/schedules/format';
import { useStrings } from '../../i18n';
import { minutesText } from '../../lib/format';
import { requestExactAlarms } from '../../platform/blocking';
import { isAndroid } from '../../platform/capabilities';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTE_STEPS = [0, 15, 30, 45];
const MINUTES_PER_HOUR = 60;

const DEFAULT_DAYS = [true, true, true, true, true, false, false];
/** A hand-started routine has no days: the engine never starts it on its own. */
const NO_DAYS = [false, false, false, false, false, false, false];
const DEFAULT_START = 9 * MINUTES_PER_HOUR;
const DEFAULT_END = 18 * MINUTES_PER_HOUR;

/** Session lengths offered for a routine you start by hand. */
const DURATION_OPTIONS_MS = [10, 20, 25, 45, 60].map((minutes) => minutes * MINUTE);

/** Timed routines start on their own; manual ones wait for you. */
type Kind = 'timed' | 'manual';

type Picking = 'start' | 'end' | null;

/**
 * Add or edit a routine: name, whether it runs at an hour or when you want, the mode
 * it turns on, and then either start, end and days (chips, no native picker) with a
 * warning when it crosses an enabled routine, or a session length.
 */
export default function ScheduleEditScreen() {
  const router = useRouter();
  const t = useStrings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const schedules = useSchedules();
  const modes = useModes();
  const activeModeId = useAppStore((state) => state.activeModeId);
  const upsertSchedule = useAppStore((state) => state.upsertSchedule);
  const deleteSchedule = useAppStore((state) => state.deleteSchedule);

  const existing = schedules.find((schedule) => schedule.id === id) ?? null;

  const kindSegments: readonly { value: Kind; label: string }[] = [
    { value: 'timed', label: t.routines.edit.kindTimed },
    { value: 'manual', label: t.routines.edit.kindManual },
  ];

  // The draft. Seeded once from the routine being edited; the store is not touched
  // until Guardar. A manual routine keeps sensible timed defaults in reserve so that
  // switching the segment does not land on an empty form.
  const [kind, setKind] = useState<Kind>(existing?.startMinutes === null ? 'manual' : 'timed');
  const [name, setName] = useState(existing?.name ?? '');
  const [startMinutes, setStartMinutes] = useState(existing?.startMinutes ?? DEFAULT_START);
  const [endMinutes, setEndMinutes] = useState<number | null>(
    existing === null || existing.startMinutes === null ? DEFAULT_END : existing.endMinutes,
  );
  const [durationMs, setDurationMs] = useState(existing?.durationMs ?? MANUAL_DEFAULT_MS);
  const [modeId, setModeId] = useState(existing?.modeId ?? activeModeId);
  const [days, setDays] = useState<boolean[]>(
    existing !== null && existing.days.some(Boolean) ? existing.days : DEFAULT_DAYS,
  );
  const [picking, setPicking] = useState<Picking>(null);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);

  const mode = modes.find((candidate) => candidate.id === modeId) ?? null;
  const draft = { startMinutes, endMinutes, days };
  // Only timed routines can clash; a hand-started one runs when you say so.
  const clash =
    kind === 'timed'
      ? schedules.find(
          (other) => other.enabled && other.id !== existing?.id && overlaps(draft, other),
        ) ?? null
      : null;
  const canSave = name.trim() !== '' && mode !== null && (kind === 'manual' || days.some(Boolean));

  const save = () => {
    const when =
      kind === 'manual'
        ? { startMinutes: null, endMinutes: null, days: NO_DAYS, durationMs }
        : { startMinutes, endMinutes, days, durationMs: null };
    upsertSchedule({
      ...(existing === null ? {} : { id: existing.id }),
      name: name.trim(),
      modeId,
      ...when,
      enabled: existing?.enabled ?? true,
    });
    // A timed window needs Android's exact-alarm toggle to open on the minute. This
    // opens its page only while it is off; iOS resolves at once and does nothing.
    if (kind === 'timed' && isAndroid) {
      void requestExactAlarms();
    }
    router.back();
  };

  const remove = () => {
    if (existing === null) {
      return;
    }
    Alert.alert(t.routines.deleteAlert.title, t.routines.deleteAlert.message, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.routines.deleteAlert.confirm,
        style: 'destructive',
        onPress: () => {
          deleteSchedule(existing.id);
          router.back();
        },
      },
    ]);
  };

  // The time sheet edits whichever of start or end is open. A null end (until you end
  // it) borrows the start's hour and minute as a baseline when a chip is tapped.
  const picked = picking === 'start' ? startMinutes : endMinutes;
  const baseline = picked ?? startMinutes;
  const setPicked = (minutes: number | null) => {
    if (picking === 'start') {
      setStartMinutes(minutes ?? DEFAULT_START);
    } else {
      setEndMinutes(minutes);
    }
  };
  const pickHour = (hour: number) => setPicked(hour * MINUTES_PER_HOUR + (baseline % MINUTES_PER_HOUR));
  const pickMinute = (minute: number) =>
    setPicked(Math.floor(baseline / MINUTES_PER_HOUR) * MINUTES_PER_HOUR + minute);

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.routines.edit.save} onPress={save} disabled={!canSave} />
          {existing === null ? null : (
            <Button label={t.routines.edit.remove} variant="ghost" onPress={remove} />
          )}
        </>
      }
    >
      <PageHeader
        onClose={() => router.back()}
        title={existing === null ? t.routines.edit.newTitle : t.routines.edit.editTitle}
      />

      <SegmentedControl segments={kindSegments} value={kind} onChange={setKind} />

      <FieldRow
        label={t.routines.edit.name}
        value={name}
        onChangeText={setName}
        placeholder={t.routines.edit.namePlaceholder}
        autoFocus={existing === null}
      />

      <ListGroup>
        {kind === 'timed' ? (
          <ListRow label={t.routines.edit.starts} value={timeText(startMinutes)} onPress={() => setPicking('start')} />
        ) : null}
        {kind === 'timed' ? (
          <ListRow
            label={t.routines.edit.ends}
            value={endMinutes === null ? t.routines.edit.openEnd : timeText(endMinutes)}
            onPress={() => setPicking('end')}
          />
        ) : null}
        <ListRow
          label={t.routines.edit.mode}
          value={mode?.name ?? t.routines.edit.pickMode}
          onPress={() => setModeSheetOpen(true)}
        />
      </ListGroup>

      {kind === 'timed' ? (
        <Section
          title={t.routines.edit.repeat}
          right={
            <Text variant="label" tone="secondary">
              {daysText(days, t.format)}
            </Text>
          }
        >
          <Card>
            <DayPicker days={days} onChange={setDays} letters={t.format.weekdayInitials} labels={t.format.shortDays} />
          </Card>
        </Section>
      ) : (
        <Section title={t.routines.edit.duration}>
          <Stack direction="row" wrap gap="sm">
            {DURATION_OPTIONS_MS.map((option) => (
              <Chip
                key={option}
                label={t.routines.edit.minutesChip(minutesText(option))}
                selected={option === durationMs}
                onPress={() => setDurationMs(option)}
              />
            ))}
          </Stack>
        </Section>
      )}

      {clash === null ? null : (
        <Card tone="muted">
          <Stack direction="row" align="flex-start" gap="md">
            <Icon name="info" size="md" tone="secondary" />
            <Stack grow gap="xs">
              <Text variant="body" weight="medium">
                {t.routines.edit.overlapTitle}
              </Text>
              <Text variant="label" tone="secondary">
                {t.routines.edit.overlapMessage(clash.name)}
              </Text>
            </Stack>
          </Stack>
        </Card>
      )}

      <Sheet visible={picking !== null} title={t.routines.edit.pickTime} onClose={() => setPicking(null)}>
        <Stack gap="lg">
          <Stack gap="sm">
            <Text variant="caption" tone="secondary">
              {t.routines.edit.hour}
            </Text>
            <Stack direction="row" wrap gap="sm">
              {HOURS.map((hour) => (
                <Chip
                  key={hour}
                  label={String(hour)}
                  selected={picked !== null && Math.floor(picked / MINUTES_PER_HOUR) === hour}
                  onPress={() => pickHour(hour)}
                />
              ))}
            </Stack>
          </Stack>
          <Stack gap="sm">
            <Text variant="caption" tone="secondary">
              {t.routines.edit.minutes}
            </Text>
            <Stack direction="row" wrap gap="sm">
              {MINUTE_STEPS.map((minute) => (
                <Chip
                  key={minute}
                  label={String(minute).padStart(2, '0')}
                  selected={picked !== null && picked % MINUTES_PER_HOUR === minute}
                  onPress={() => pickMinute(minute)}
                />
              ))}
              {picking === 'end' ? (
                <Chip label={t.routines.edit.openEnd} selected={picked === null} onPress={() => setPicked(null)} />
              ) : null}
            </Stack>
          </Stack>
          <Button label={t.common.done} onPress={() => setPicking(null)} />
        </Stack>
      </Sheet>

      <Sheet visible={modeSheetOpen} title={t.routines.edit.mode} onClose={() => setModeSheetOpen(false)}>
        <ListGroup>
          {modes.map((candidate) => (
            <ListRow
              key={candidate.id}
              label={candidate.name}
              right={<Check checked={candidate.id === modeId} />}
              onPress={() => {
                setModeId(candidate.id);
                setModeSheetOpen(false);
              }}
            />
          ))}
        </ListGroup>
      </Sheet>
    </Screen>
  );
}
