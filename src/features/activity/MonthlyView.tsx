import { useMemo, useState } from 'react';

import type { DayStat } from '../../data/types';
import { BarChart, Card, HorizontalBars, Section, Stack, Text } from '../../design/components';
import { PeriodStrip } from '../../design/components';
import { HOUR } from '../../domain/time';
import { durationText } from '../../lib/format';
import { monthLabel, monthStart } from './dates';
import { monthBars, monthTotals, weekdayRhythm } from './selectors';

const MONTH_GUIDES = [
  { value: 10 * HOUR, label: '10h' },
  { value: 5 * HOUR, label: '5h' },
] as const;

type MonthlyViewProps = {
  stats: ReadonlyArray<DayStat>;
  now: number;
};

/** The month's total, a bar per day, and the weekday rhythm over the whole history. */
export function MonthlyView({ stats, now }: MonthlyViewProps) {
  const [offset, setOffset] = useState(0);
  const periods = useMemo(
    () => [
      { key: '1', label: monthLabel(monthStart(now, 1)).toUpperCase() },
      { key: '0', label: monthLabel(monthStart(now)).toUpperCase() },
    ],
    [now],
  );
  const bars = useMemo(() => monthBars(stats, now, offset), [stats, now, offset]);
  const totals = useMemo(() => monthTotals(stats, now, offset), [stats, now, offset]);
  const rhythm = useMemo(() => weekdayRhythm(stats), [stats]);
  const thisMonth = offset === 0 ? 'este mes' : 'ese mes';

  return (
    <Stack gap="lg">
      <PeriodStrip
        options={periods}
        selectedKey={String(offset)}
        onSelect={(key) => setOffset(Number(key))}
      />
      <Section title="Tiempo enfocado total">
        <Text variant="title">{durationText(totals.totalMs)}</Text>
        <Text variant="label" tone="secondary">
          {totals.averageMs === null
            ? `Todavía no hay días enfocados ${thisMonth}.`
            : `Tu promedio diario ${thisMonth} fue ${durationText(totals.averageMs)}`}
        </Text>
      </Section>
      <Card>
        <BarChart bars={bars} guides={MONTH_GUIDES} average={totals.averageMs ?? undefined} />
      </Card>
      <Card>
        <Stack gap="sm">
          <Text variant="caption" tone="secondary">
            PATRONES
          </Text>
          <Text variant="heading">Tu ritmo semanal</Text>
          <Text variant="label" tone="secondary">
            Así se ve tu tiempo enfocado promedio por día de la semana.
          </Text>
          <HorizontalBars rows={rhythm} />
        </Stack>
      </Card>
    </Stack>
  );
}
