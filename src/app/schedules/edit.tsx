import { useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useAppStore, useModes, useSchedules } from '../../data';
import {
  Button,
  Card,
  ChipGroup,
  DayPicker,
  FieldRow,
  ListGroup,
  ListRow,
  NoticeCard,
  PageHeader,
  Screen,
  Section,
  SegmentedControl,
  StatusNote,
  Text,
} from '../../design/components';
import { MANUAL_DEFAULT_MS } from '../../domain/routines';
import { MINUTE } from '../../domain/time';
import { ModeSheet } from '../../features/modes/ModeSheet';
import { daysText, endsNextDay, overlaps, timeText } from '../../features/schedules/format';
import { TimeSheet } from '../../features/schedules/TimeSheet';
import { useStrings } from '../../i18n';
import { minutesText } from '../../lib/format';

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
 *
 * The window reads as the engine will run it (domain/routines): an end at or before
 * the start is the next day and says so, the same start and end would be a whole day
 * and cannot be saved, and no end time is the open-end cap, said with its hours.
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
  const modeWasMissing = existing !== null && !modes.some((candidate) => candidate.id === existing.modeId);
  const draft = { startMinutes, endMinutes, days };
  // Start and end on the same minute is a 24-hour window for the engine; nobody means that.
  const sameStartEnd = kind === 'timed' && endMinutes === startMinutes;
  // Only timed routines can clash, and a routine that is off cannot: the tab never
  // lists it as crossing either. A hand-started one runs when you say so.
  const clash =
    kind === 'timed' && existing?.enabled !== false
      ? (schedules.find((other) => other.enabled && other.id !== existing?.id && overlaps(draft, other)) ?? null)
      : null;
  const canSave =
    name.trim() !== '' && mode !== null && (kind === 'manual' || (days.some(Boolean) && !sameStartEnd));

  const endText =
    endMinutes === null
      ? t.routines.edit.openEnd
      : endsNextDay({ startMinutes, endMinutes })
        ? t.routines.edit.nextDay(timeText(endMinutes))
        : timeText(endMinutes);

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
      // A routine whose mode was deleted was switched off with it (deleteMode); giving
      // it a mode again turns it back on. A manual routine has no switch at all, so it
      // is always on. Otherwise a timed one keeps its switch where the user left it.
      enabled: kind === 'manual' || modeWasMissing ? true : (existing?.enabled ?? true),
    });
    // Exact alarms are not asked for here: the Rutinas tab says what they change and
    // offers the page. Throwing the user into Settings on every save explains nothing.
    goBack(router);
  };

  const remove = () => {
    if (existing === null) {
      return;
    }
    Alert.alert(t.routines.deleteAlert.title(existing.name), t.routines.deleteAlert.message, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.routines.deleteAlert.confirm,
        style: 'destructive',
        onPress: () => {
          deleteSchedule(existing.id);
          goBack(router);
        },
      },
    ]);
  };

  const createMode = () => {
    setModeSheetOpen(false);
    router.push('/modes/edit');
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      footer={
        <>
          <Button label={t.routines.edit.save} onPress={save} disabled={!canSave} />
          {existing === null ? null : (
            <Button label={t.routines.edit.remove} variant="ghost" tone="danger" onPress={remove} />
          )}
        </>
      }
    >
      <PageHeader
        onBack={() => goBack(router)}
        title={existing === null ? t.routines.edit.newTitle : t.routines.edit.editTitle}
      />

      <FieldRow
        label={t.routines.edit.name}
        value={name}
        onChangeText={setName}
        placeholder={t.routines.edit.namePlaceholder}
        autoFocus={existing === null}
      />

      <SegmentedControl segments={kindSegments} value={kind} onChange={setKind} />

      <ListGroup>
        {kind === 'timed' ? (
          <ListRow label={t.routines.edit.starts} value={timeText(startMinutes)} onPress={() => setPicking('start')} />
        ) : null}
        {kind === 'timed' ? (
          <ListRow label={t.routines.edit.ends} value={endText} onPress={() => setPicking('end')} />
        ) : null}
        <ListRow
          label={t.routines.edit.mode}
          value={mode?.name ?? t.routines.edit.pickMode}
          onPress={() => setModeSheetOpen(true)}
        />
      </ListGroup>
      {sameStartEnd ? <StatusNote text={t.routines.edit.sameStartEnd} tone="danger" icon="alert-circle" live /> : null}

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
          <ChipGroup
            accessibilityLabel={t.routines.edit.duration}
            options={DURATION_OPTIONS_MS.map((option) => ({
              value: option,
              label: t.routines.edit.minutesChip(minutesText(option)),
            }))}
            value={durationMs}
            onChange={setDurationMs}
          />
        </Section>
      )}

      {clash === null ? null : (
        <NoticeCard
          tone="muted"
          icon="info"
          title={t.routines.edit.overlapTitle}
          body={t.routines.edit.overlapMessage(clash.name)}
        />
      )}

      <TimeSheet
        visible={picking !== null}
        title={picking === 'end' ? t.routines.edit.ends : t.routines.edit.starts}
        value={picking === 'end' ? endMinutes : startMinutes}
        openEnd={picking === 'end'}
        onClose={() => setPicking(null)}
        onDone={(minutes) => {
          if (picking === 'start') {
            setStartMinutes(minutes ?? startMinutes);
          } else if (picking === 'end') {
            setEndMinutes(minutes);
          }
          setPicking(null);
        }}
      />

      <ModeSheet
        visible={modeSheetOpen}
        title={t.routines.edit.mode}
        modes={modes}
        selectedId={mode?.id ?? null}
        onSelect={(next) => {
          setModeId(next);
          setModeSheetOpen(false);
        }}
        onClose={() => setModeSheetOpen(false)}
        onCreate={createMode}
        createLabel={t.routines.edit.createMode}
      />
    </Screen>
  );
}
