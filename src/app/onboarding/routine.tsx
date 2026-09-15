import { router } from 'expo-router';
import { useState } from 'react';

import { useOnboardingDraft } from '../../data/onboardingDraft';
import {
  Button,
  DayPicker,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Text,
} from '../../design/components';
import { TimeSheet } from '../../features/onboarding/TimeSheet';
import { daysText, timeText } from '../../features/schedules/format';

const OPEN_END_LABEL = 'Al terminar vos';

/** Optional: make the first mode a routine. Start, end and days, then continue or skip. */
export default function RoutineScreen() {
  const modeName = useOnboardingDraft((state) => state.modeName);
  const schedule = useOnboardingDraft((state) => state.schedule);
  const setSchedule = useOnboardingDraft((state) => state.setSchedule);
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Continuar" onPress={() => router.push('/onboarding/routine-set')} />
          <Button
            label="Saltar"
            variant="ghost"
            onPress={() => router.push('/onboarding/notifications')}
          />
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="title">{`¿Hacemos ${modeName || 'tu modo'} una rutina?`}</Text>
      <Text variant="label" tone="secondary">
        La gente con horarios sostiene el hábito 2,5 veces más.
      </Text>

      <ListGroup>
        <ListRow
          label="Empieza"
          value={timeText(schedule.startMinutes)}
          onPress={() => setEditing('start')}
        />
        <ListRow
          label="Termina"
          value={schedule.endMinutes === null ? OPEN_END_LABEL : timeText(schedule.endMinutes)}
          onPress={() => setEditing('end')}
        />
      </ListGroup>

      <Section
        title="Repetir"
        right={
          <Text variant="label" tone="secondary">
            {daysText(schedule.days)}
          </Text>
        }
      >
        <DayPicker days={schedule.days} onChange={(days) => setSchedule({ days })} />
      </Section>

      <TimeSheet
        visible={editing !== null}
        title="Elegí la hora"
        value={editing === 'end' ? schedule.endMinutes : schedule.startMinutes}
        openEnd={editing === 'end'}
        onClose={() => setEditing(null)}
        onDone={(minutes) => {
          if (editing === 'start') {
            setSchedule({ startMinutes: minutes ?? schedule.startMinutes });
          } else if (editing === 'end') {
            setSchedule({ endMinutes: minutes });
          }
          setEditing(null);
        }}
      />
    </Screen>
  );
}
