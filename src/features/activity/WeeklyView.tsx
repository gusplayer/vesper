import { useMemo, useState } from 'react';

import type { DayStat } from '../../data/types';
import {
  BarChart,
  Card,
  Icon,
  ProgressBar,
  Section,
  Stack,
  Text,
} from '../../design/components';
import { PeriodStrip } from '../../design/components';
import { useLocale, useStrings } from '../../i18n';
import { durationText } from '../../lib/format';
import { CircleWeekSection } from '../circle/CircleWeekSection';
import { dayLabel } from './dates';
import {
  deltaVsPrevious,
  niceGuides,
  weekAverage,
  weekBars,
  weekDayCards,
  type CalendarDay,
  type Delta,
} from './selectors';
import { chartSummary, dayCardSummary, deltaText, sessionsText } from './text';

type WeeklyViewProps = {
  stats: ReadonlyArray<DayStat>;
  now: number;
};

/** Average per day, the seven bars, and one card per day back to Monday. */
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
      />
      <Section title={t.activity.weekly.averagePerDay}>
        <Text variant="title">{average === null ? t.common.empty : durationText(average)}</Text>
        <DeltaLine delta={delta} firstWeek={average === null && offset === 0} />
      </Section>
      <BarChart
        bars={bars}
        guides={guides}
        average={average ?? undefined}
        accessibilityLabel={spokenChart}
      />
      <Stack gap="md">
        {days.map((day) => (
          <DayCard key={day.dayKey} day={day} />
        ))}
      </Stack>
      {offset === 0 ? <CircleWeekSection now={now} /> : null}
    </Stack>
  );
}

function DeltaLine({ delta, firstWeek }: { delta: Delta | null; firstWeek: boolean }) {
  const t = useStrings();
  const { tag } = useLocale();
  if (delta === null) {
    // Nothing to compare against yet. The line only speaks up while the very first
    // week is still empty; a quiet past week just shows its average.
    return firstWeek ? (
      <Text variant="label" tone="secondary">
        {t.activity.weekly.firstWeek}
      </Text>
    ) : null;
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
            {day.isToday ? t.activity.weekly.today : dayLabel(day.at, t.activity, tag).toUpperCase()}
          </Text>
          {day.isToday ? (
            <Text variant="caption" tone="accent">
              ●
            </Text>
          ) : null}
        </Stack>
        <Text variant="heading">{durationText(day.stat.focusMs)}</Text>
        <Text variant="label" tone="secondary">
          {sessionsText(day.stat.sessions, t.activity)}
        </Text>
        <ProgressBar progress={0} segments={day.stat.segments} />
      </Stack>
    </Card>
  );
}
