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
import { sessionsText } from './text';

const PERIODS = [
  { key: '1', label: 'SEMANA PASADA' },
  { key: '0', label: 'ESTA SEMANA' },
] as const;

const FIRST_WEEK = 'Tu primera semana está en marcha. Volvé por tu promedio.';

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

  return (
    <Stack gap="lg">
      <PeriodStrip
        options={PERIODS}
        selectedKey={String(offset)}
        onSelect={(key) => setOffset(Number(key))}
      />
      <Section title="Tiempo enfocado promedio">
        <Text variant="title">{average === null ? '—' : durationText(average)}</Text>
        <DeltaLine delta={delta} offset={offset} />
      </Section>
      <Card>
        <BarChart bars={bars} guides={guides} average={average ?? undefined} />
      </Card>
      <Stack gap="md">
        {days.map((day) => (
          <DayCard key={day.dayKey} day={day} />
        ))}
      </Stack>
    </Stack>
  );
}

function DeltaLine({ delta, offset }: { delta: Delta | null; offset: number }) {
  if (delta === null) {
    return (
      <Text variant="label" tone="secondary">
        {FIRST_WEEK}
      </Text>
    );
  }
  const against = offset === 0 ? 'vs semana pasada' : 'vs la semana anterior';
  if (delta.direction === 'flat') {
    return (
      <Stack direction="row" gap="xs" align="center">
        <Icon name="minus" size="sm" tone="secondary" />
        <Text variant="label" tone="secondary">
          {`Igual ${against}`}
        </Text>
      </Stack>
    );
  }
  return (
    <Stack direction="row" gap="xs" align="center">
      <Icon
        name={delta.direction === 'up' ? 'arrow-up-right' : 'arrow-down-right'}
        size="sm"
        tone="secondary"
      />
      <Text variant="label" tone="secondary">
        {`${delta.percent}% ${against}`}
      </Text>
    </Stack>
  );
}

function DayCard({ day }: { day: CalendarDay }) {
  return (
    <Card>
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
