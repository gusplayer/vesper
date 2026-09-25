import { useMemo, useState } from 'react';

import type { DayStat } from '../../data/types';
import { BarChart, Card, Dot, Icon, PeriodStrip, ProgressBar, Section, Stack, Text } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { CircleWeekSection } from '../circle/CircleWeekSection';
import { dayLabel } from './dates';
import { HabitsSection } from './HabitsSection';
import {
  deltaVsPrevious,
  emptyWeekLine,
  niceGuides,
  weekAverage,
  weekBars,
  weekDayCards,
  type CalendarDay,
  type Delta,
  type EmptyWeekLine,
} from './selectors';
import { chartSummary, dayCardSummary, deltaText, sessionsText } from './text';

type WeeklyViewProps = {
  stats: readonly DayStat[];
  now: number;
};

/**
 * Average per day, the seven bars, this week's habits, and one card per day back to
 * Monday. The habits sit right under the chart because marking one is a daily action
 * (ADR-0047 §7); like the circle, they belong to this week only — last week's view has
 * no "today" to mark.
 */
export function WeeklyView({ stats, now }: WeeklyViewProps) {
  const t = useStrings();
  const { tag } = useLocale();
  const [offset, setOffset] = useState(0);
  const periods = useMemo(
    () => [
      { key: '1', label: t.activity.weekly.lastWeek },
      { key: '0', label: t.activity.weekly.thisWeek },
    ],
    [t],
  );
  const bars = useMemo(() => weekBars(stats, now, offset, tag), [stats, now, offset, tag]);
  const guides = useMemo(() => niceGuides(bars), [bars]);
  const average = useMemo(() => weekAverage(stats, now, offset), [stats, now, offset]);
  const delta = useMemo(() => deltaVsPrevious(stats, now, offset), [stats, now, offset]);
  const days = useMemo(() => weekDayCards(stats, now, offset), [stats, now, offset]);
  const empty = useMemo(() => emptyWeekLine(stats, now, offset), [stats, now, offset]);
  // The cards stop at today, and so does what VoiceOver reads for the chart: a day that
  // has not happened is not 'sin foco'.
  const spokenChart = useMemo(
    () => chartSummary(bars.slice(0, days.length), t.activity, tag),
    [bars, days, t, tag],
  );

  return (
    <Stack gap="lg">
      <PeriodStrip
        options={periods}
        selectedKey={String(offset)}
        onSelect={(key) => setOffset(Number(key))}
        locale={tag}
      />
      <Section title={t.activity.weekly.averagePerDay}>
        <Text variant="title">{average === null ? t.common.empty : durationText(average)}</Text>
        <DeltaLine delta={delta} empty={empty} />
      </Section>
      <BarChart
        bars={bars}
        guides={guides}
        average={average ?? undefined}
        averageLabel={t.activity.chart.average}
        accessibilityLabel={spokenChart}
      />
      {offset === 0 ? <HabitsSection now={now} /> : null}
      <Stack gap="md">
        {days.map((day) => (
          <DayCard key={day.dayKey} day={day} />
        ))}
      </Stack>
      {offset === 0 ? <CircleWeekSection now={now} /> : null}
    </Stack>
  );
}

function DeltaLine({ delta, empty }: { delta: Delta | null; empty: EmptyWeekLine | null }) {
  const t = useStrings();
  const { tag } = useLocale();
  if (empty !== null) {
    // An empty week says which kind of empty it is: the very first one, this week
    // before its first session, or a past week that had none (selectors.emptyWeekLine).
    return (
      <Text variant="label" tone="secondary">
        {t.activity.weekly[empty]}
      </Text>
    );
  }
  if (delta === null) {
    // Nothing to compare against yet: fewer than two focused days in one of the weeks.
    return null;
  }
  const icon =
    delta.direction === 'up' ? 'arrow-up-right' : delta.direction === 'down' ? 'arrow-down-right' : 'minus';
  return (
    <Stack direction="row" gap="xs" align="center">
      <Icon name={icon} size="sm" tone="secondary" />
      <Text variant="label" tone="secondary">
        {deltaText(delta, t.activity, tag)}
      </Text>
    </Stack>
  );
}

function DayCard({ day }: { day: CalendarDay }) {
  const t = useStrings();
  const { tag } = useLocale();
  // The card is one thing to VoiceOver; the segmented bar inside is decoration.
  return (
    <Card accessibilityLabel={dayCardSummary(day, t.activity, tag)}>
      <Stack gap="sm">
        <Stack direction="row" gap="xs" align="center">
          <Text variant="caption" tone="secondary">
            {day.isToday ? t.activity.weekly.today : dayLabel(day.at, t.activity, tag)}
          </Text>
          {day.isToday ? <Dot /> : null}
        </Stack>
        <Text variant="heading">{durationText(day.stat.focusMs)}</Text>
        <Text variant="label" tone="secondary">
          {sessionsText(day.stat.sessions, t.activity)}
        </Text>
        {/* An empty track under 'Sin sesiones' says nothing twice. */}
        {day.stat.sessions === 0 ? null : <ProgressBar progress={0} segments={day.stat.segments} />}
      </Stack>
    </Card>
  );
}
