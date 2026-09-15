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
  Sheet,
  Stack,
  Text,
} from '../../design/components';
import { daysText, overlaps, timeText } from '../../features/schedules/format';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTE_STEPS = [0, 15, 30, 45];
const MINUTES_PER_HOUR = 60;

const DEFAULT_DAYS = [true, true, true, true, true, false, false];
const DEFAULT_START = 9 * MINUTES_PER_HOUR;
const DEFAULT_END = 18 * MINUTES_PER_HOUR;

/** What "Termina" says when the schedule runs until the user ends it. */
const OPEN_END = 'Al terminar vos';

type Picking = 'start' | 'end' | null;

/**
 * Add or edit a schedule: name, start and end (chips, no native picker), the mode it
 * turns on, the days it repeats, and a warning when it crosses an enabled schedule.
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

  // The draft. Seeded once from the schedule being edited; the store is not touched
  // until Guardar.
  const [name, setName] = useState(existing?.name ?? '');
  const [startMinutes, setStartMinutes] = useState(existing?.startMinutes ?? DEFAULT_START);
  const [endMinutes, setEndMinutes] = useState<number | null>(
    existing === null ? DEFAULT_END : existing.endMinutes,
  );
  const [modeId, setModeId] = useState(existing?.modeId ?? activeModeId);
  const [days, setDays] = useState<boolean[]>(existing?.days ?? DEFAULT_DAYS);
  const [picking, setPicking] = useState<Picking>(null);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);

  const mode = modes.find((candidate) => candidate.id === modeId) ?? null;
  const draft = { startMinutes, endMinutes, days };
  const clash =
    schedules.find(
      (other) => other.enabled && other.id !== existing?.id && overlaps(draft, other),
    ) ?? null;
  const canSave = name.trim() !== '' && days.some(Boolean) && mode !== null;

  const save = () => {
    upsertSchedule({
      ...(existing === null ? {} : { id: existing.id }),
      name: name.trim(),
      modeId,
      startMinutes,
      endMinutes,
      days,
      enabled: existing?.enabled ?? true,
    });
    router.back();
  };

  const remove = () => {
    if (existing === null) {
      return;
    }
    Alert.alert('¿Eliminar este horario?', 'No se puede deshacer.', [
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
          <Button label="Guardar horario" onPress={save} disabled={!canSave} />
          {existing === null ? null : (
            <Button label="Eliminar horario" variant="ghost" onPress={remove} />
          )}
        </>
      }
    >
      <PageHeader
        onClose={() => router.back()}
        title={existing === null ? 'Agregar horario' : 'Editar horario'}
      />

      <FieldRow
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="p. ej. Trabajo, Familia"
        autoFocus={existing === null}
      />

      <ListGroup>
        <ListRow label="Empieza" value={timeText(startMinutes)} onPress={() => setPicking('start')} />
        <ListRow
          label="Termina"
          value={endMinutes === null ? OPEN_END : timeText(endMinutes)}
          onPress={() => setPicking('end')}
        />
        <ListRow label="Modo" value={mode?.name ?? 'Elegí uno'} onPress={() => setModeSheetOpen(true)} />
      </ListGroup>

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

      {clash === null ? null : (
        <Card tone="muted">
          <Stack direction="row" align="flex-start" gap="md">
            <Icon name="info" size="md" tone="secondary" />
            <Stack grow gap="xs">
              <Text variant="body" weight="medium">
                Horarios superpuestos
              </Text>
              <Text variant="label" tone="secondary">
                {`Este horario se cruza con '${clash.name}'. Si los dos están encendidos, solo uno corre a la vez.`}
              </Text>
            </Stack>
          </Stack>
        </Card>
      )}

      <Sheet visible={picking !== null} title="Elegí la hora" onClose={() => setPicking(null)}>
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
