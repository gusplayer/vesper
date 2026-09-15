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
import { durationText } from '../../lib/format';
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

const PERIODS = [
  { key: '1', label: 'SEMANA PASADA' },
  { key: '0', label: 'ESTA SEMANA' },
] as const;

const FIRST_WEEK = 'Tu primera semana está en marcha. Vuelve por tu promedio.';

type WeeklyViewProps = {
  stats: ReadonlyArray<DayStat>;
  now: number;
};

/** Average per day, the seven bars, and one card per day back to Monday. */
export function WeeklyView({ stats, now }: WeeklyViewProps) {
  const [offset, setOffset] = useState(0);
  const bars = useMemo(() => weekBars(stats, now, offset), [stats, now, offset]);
  const guides = useMemo(() => niceGuides(bars), [bars]);
  const average = useMemo(() => weekAverage(stats, now, offset), [stats, now, offset]);
  const delta = useMemo(() => deltaVsPrevious(stats, now, offset), [stats, now, offset]);
  const days = useMemo(() => weekDayCards(stats, now, offset), [stats, now, offset]);
  // The cards stop at today, and so does what VoiceOver reads for the chart: a day that
  // has not happened is not 'sin foco'.
  const spokenChart = useMemo(() => chartSummary(bars.slice(0, days.length)), [bars, days]);

  return (
    <Stack gap="lg">
      <PeriodStrip
        options={PERIODS}
        selectedKey={String(offset)}
        onSelect={(key) => setOffset(Number(key))}
      />
      <Section title="Promedio por día">
        <Text variant="title">{average === null ? '—' : durationText(average)}</Text>
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
    </Stack>
  );
}

function DeltaLine({ delta, firstWeek }: { delta: Delta | null; firstWeek: boolean }) {
  if (delta === null) {
    // Nothing to compare against yet. The line only speaks up while the very first
    // week is still empty; a quiet past week just shows its average.
    return firstWeek ? (
      <Text variant="label" tone="secondary">
        {FIRST_WEEK}
      </Text>
    ) : null;
  }
  const icon =
    delta.direction === 'up' ? 'arrow-up-right' : delta.direction === 'down' ? 'arrow-down-right' : 'minus';
  return (
    <Stack direction="row" gap="xs" align="center">
      <Icon name={icon} size="sm" tone="secondary" />
      <Text variant="label" tone="secondary">
        {deltaText(delta)}
      </Text>
    </Stack>
  );
}

function DayCard({ day }: { day: CalendarDay }) {
  // The card is one thing to VoiceOver; the segmented bar inside is decoration.
  return (
    <Card accessibilityLabel={dayCardSummary(day)}>
      <Stack gap="sm">
        <Stack direction="row" gap="xs" align="center">
          <Text variant="caption" tone="secondary">
            {day.isToday ? 'HOY' : dayLabel(day.at).toUpperCase()}
          </Text>
          {day.isToday ? (
            <Text variant="caption" tone="accent">
              ●
            </Text>
          ) : null}
        </Stack>
        <Text variant="heading">{durationText(day.stat.focusMs)}</Text>
        <Text variant="label" tone="secondary">
          {sessionsText(day.stat.sessions)}
        </Text>
        <ProgressBar progress={0} segments={day.stat.segments} />
      </Stack>
    </Card>
  );
}
