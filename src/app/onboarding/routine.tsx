import { router } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { useState } from 'react';

import { useSchedules } from '../../data';
import { savedOnboardingIds } from '../../data/onboardingIds';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import {
  Button,
  DayPicker,
  ListGroup,
  ListRow,
  NoticeCard,
  PageHeader,
  Screen,
  Section,
  StatusNote,
  Text,
} from '../../design/components';
import { skipOnboardingRoutine } from '../../features/onboarding/commit';
import { stepProgress } from '../../features/onboarding/steps';
import { TimeSheet } from '../../features/schedules/TimeSheet';
import { daysText, endsNextDay, overlaps, timeText } from '../../features/schedules/format';
import { useStrings } from '../../i18n';

/**
 * Optional: make the first mode a routine. Start, end and days, then continue or skip.
 *
 * The same rules as the routine editor: at least one day, an end that is not the
 * start, and a card when the window crosses another routine that is on — the demo
 * "Trabajo" and "Hora de dormir" sit exactly where two of the ideas propose theirs.
 * "Saltar" also removes a routine this onboarding saved earlier, so going back and
 * skipping does not leave it running.
 */
export default function RoutineScreen() {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const schedule = useOnboardingDraft((state) => state.schedule);
  const setSchedule = useOnboardingDraft((state) => state.setSchedule);
  const draftScheduleId = useOnboardingDraft((state) => state.scheduleId);
  const schedules = useSchedules();
  // A routine an earlier run saved before the app was killed is this draft's own too.
  const [savedScheduleId] = useState(() => savedOnboardingIds().scheduleId);
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);

  const copy = t.onboarding.routine;
  const words = t.routines.edit;
  const ownId = draftScheduleId ?? savedScheduleId;

  const noDays = !schedule.days.some(Boolean);
  const sameStartEnd = schedule.endMinutes !== null && schedule.endMinutes === schedule.startMinutes;
  const clash =
    schedules.find(
      (other) => other.enabled && other.startMinutes !== null && other.id !== ownId && overlaps(schedule, other),
    ) ?? null;

  const endText =
    schedule.endMinutes === null
      ? words.openEnd
      : endsNextDay(schedule)
        ? words.nextDay(timeText(schedule.endMinutes))
        : timeText(schedule.endMinutes);

  const skip = () => {
    skipOnboardingRoutine();
    router.push('/onboarding/notifications');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label={t.common.continue}
            onPress={() => router.push('/onboarding/routine-set')}
            disabled={noDays || sameStartEnd}
          />
          <Button label={copy.skip} variant="ghost" onPress={skip} />
        </>
      }
    >
      <PageHeader onBack={() => goBack(router)} progress={stepProgress('routine', t.onboarding.progress)} />
      <Text variant="title">{copy.title(modeName || copy.yourMode)}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>

      <ListGroup>
        <ListRow
          label={words.starts}
          value={timeText(schedule.startMinutes ?? 0)}
          onPress={() => setEditing('start')}
        />
        <ListRow label={words.ends} value={endText} onPress={() => setEditing('end')} />
      </ListGroup>
      {sameStartEnd ? <StatusNote text={words.sameStartEnd} icon="alert-circle" live /> : null}

      <Section
        title={words.repeat}
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
        {noDays ? <StatusNote text={copy.noDays} icon="alert-circle" live /> : null}
      </Section>

      {clash === null ? null : (
        <NoticeCard
          tone="muted"
          icon="info"
          title={words.overlapTitle}
          body={words.overlapMessage(clash.name)}
        />
      )}

      <TimeSheet
        visible={editing !== null}
        title={editing === 'end' ? words.ends : words.starts}
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
