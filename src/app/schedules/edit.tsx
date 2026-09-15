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
import { minutesText } from '../../lib/format';

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

/** What "Termina" says when the schedule runs until the user ends it. */
const OPEN_END = 'Hasta que lo termines';

/** Timed routines start on their own; manual ones wait for you. */
type Kind = 'timed' | 'manual';

const KIND_SEGMENTS = [
  { value: 'timed', label: 'A una hora' },
  { value: 'manual', label: 'Cuando quieras' },
] as const;

type Picking = 'start' | 'end' | null;

/**
 * Add or edit a routine: name, whether it runs at an hour or when you want, the mode
 * it turns on, and then either start, end and days (chips, no native picker) with a
 * warning when it crosses an enabled routine, or a session length.
 */
export default function ScheduleEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const schedules = useSchedules();
  const modes = useModes();
  const activeModeId = useAppStore((state) => state.activeModeId);
  const upsertSchedule = useAppStore((state) => state.upsertSchedule);
  const deleteSchedule = useAppStore((state) => state.deleteSchedule);

  const existing = schedules.find((schedule) => schedule.id === id) ?? null;

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
    router.back();
  };

  const remove = () => {
    if (existing === null) {
      return;
    }
    Alert.alert('¿Eliminar esta rutina?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
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
          <Button label="Guardar rutina" onPress={save} disabled={!canSave} />
          {existing === null ? null : (
            <Button label="Eliminar rutina" variant="ghost" onPress={remove} />
          )}
        </>
      }
    >
      <PageHeader
        onClose={() => router.back()}
        title={existing === null ? 'Nueva rutina' : 'Editar rutina'}
      />

      <SegmentedControl segments={KIND_SEGMENTS} value={kind} onChange={setKind} />

      <FieldRow
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="p. ej. Trabajo, Familia"
        autoFocus={existing === null}
      />

      <ListGroup>
        {kind === 'timed' ? (
          <ListRow label="Empieza" value={timeText(startMinutes)} onPress={() => setPicking('start')} />
        ) : null}
        {kind === 'timed' ? (
          <ListRow
            label="Termina"
            value={endMinutes === null ? OPEN_END : timeText(endMinutes)}
            onPress={() => setPicking('end')}
          />
        ) : null}
        <ListRow label="Modo" value={mode?.name ?? 'Elige uno'} onPress={() => setModeSheetOpen(true)} />
      </ListGroup>

      {kind === 'timed' ? (
        <Section
          title="Repetir"
          right={
            <Text variant="label" tone="secondary">
              {daysText(days)}
            </Text>
          }
        >
          <Card>
            <DayPicker days={days} onChange={setDays} />
          </Card>
        </Section>
      ) : (
        <Section title="Duración">
          <Stack direction="row" wrap gap="sm">
            {DURATION_OPTIONS_MS.map((option) => (
              <Chip
                key={option}
                label={`${minutesText(option)} min`}
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
                Rutinas superpuestas
              </Text>
              <Text variant="label" tone="secondary">
                {`Esta rutina se cruza con '${clash.name}'. Si las dos están encendidas, solo una corre a la vez.`}
              </Text>
            </Stack>
          </Stack>
        </Card>
      )}

      <Sheet visible={picking !== null} title="Elige la hora" onClose={() => setPicking(null)}>
        <Stack gap="lg">
          <Stack gap="sm">
            <Text variant="caption" tone="secondary">
              hora
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
              minutos
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
                <Chip label={OPEN_END} selected={picked === null} onPress={() => setPicked(null)} />
              ) : null}
            </Stack>
          </Stack>
          <Button label="Listo" onPress={() => setPicking(null)} />
        </Stack>
      </Sheet>

      <Sheet visible={modeSheetOpen} title="Modo" onClose={() => setModeSheetOpen(false)}>
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
