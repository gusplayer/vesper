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
import { useStrings } from '../../i18n';

/** Optional: make the first mode a routine. Start, end and days, then continue or skip. */
export default function RoutineScreen() {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const schedule = useOnboardingDraft((state) => state.schedule);
  const setSchedule = useOnboardingDraft((state) => state.setSchedule);
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);

  const copy = t.onboarding.routine;

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.common.continue} onPress={() => router.push('/onboarding/routine-set')} />
          <Button label={copy.skip} variant="ghost" onPress={() => router.push('/onboarding/notifications')} />
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="title">{copy.title(modeName || copy.yourMode)}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>

      <ListGroup>
        <ListRow
          label={copy.starts}
          value={timeText(schedule.startMinutes ?? 0)}
          onPress={() => setEditing('start')}
        />
        <ListRow
          label={copy.ends}
          value={schedule.endMinutes === null ? copy.openEnd : timeText(schedule.endMinutes)}
          onPress={() => setEditing('end')}
        />
      </ListGroup>

      <Section
        title={copy.repeat}
        right={
          <Text variant="label" tone="secondary">
            {daysText(schedule.days, t.format)}
          </Text>
        }
      >
        <DayPicker
          days={schedule.days}
          onChange={(days) => setSchedule({ days })}
          letters={t.format.weekdayInitials}
          labels={t.format.shortDays}
        />
      </Section>

      <TimeSheet
        visible={editing !== null}
        title={copy.pickTime}
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
